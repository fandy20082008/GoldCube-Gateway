import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, resolve, isAbsolute, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { checkPublicSnapshot } from "./check-public-snapshot.mjs";

const kinds = ["proxy", "shell", "assets", "deployment"];
const repository = "fandy20082008/GoldCube-Gateway";
const applicationRepository = "fandy20082008/GoldCube";
const reviews = ["provenance", "licenses", "materials", "secrets", "sourceAccess", "rebuild", "deploymentInventory"];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const fail = (message) => { throw new Error(message); };

export function checkOpenSource({ root, manifest, mode = "structure", snapshotProof = process.env.GOLDCUBE_SNAPSHOT_PROOF, snapshotProofSha256 = process.env.GOLDCUBE_SNAPSHOT_PROOF_SHA256 }) {
    if (!["structure", "release"].includes(mode)) fail("Unknown mode");
    const data = JSON.parse(readFileSync(manifest, "utf8"));
    if (data.schemaVersion !== 1) fail("Expected schemaVersion 1");
    if (data.repository !== repository || data.applicationRepository !== applicationRepository) fail("Expected exact Gateway and application repository mapping");
    if (!Array.isArray(data.materials) || !data.materials.length) fail("Material inventory is required");
    for (const item of data.materials) {
        if (!nonempty(item.id) || !nonempty(item.scope) || !nonempty(item.source) || !nonempty(item.license) || !["unknown", "approved", "rejected"].includes(item.status)) fail("Invalid material inventory entry");
    }
    for (const kind of kinds) {
        if (!Array.isArray(data.sourceScope?.[kind]) || !data.sourceScope[kind].length || !data.sourceScope[kind].every(nonempty)) fail(`Missing source scope: ${kind}`);
    }
    for (const review of reviews) {
        const item = data.reviews?.[review];
        if (!item || !["unknown", "approved", "rejected"].includes(item.status) || !(item.evidence === "" || (item.evidence && typeof item.evidence === "object"))) fail(`Missing review: ${review}`);
    }
    if (!data.release || typeof data.release.commit !== "string" || !data.release.archive || !Array.isArray(data.release.artifacts)) fail("Missing release mapping");
    if (mode === "structure") return { mode, releaseApproved: false, message: "Structure valid; no release approval" };

    const git = (...args) => execFileSync("git", ["--no-replace-objects", ...args], { cwd: root, env: { ...process.env, GIT_NO_LAZY_FETCH: "1" }, maxBuffer: 128 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
    const commit = data.release.commit;
    if (!/^[0-9a-f]{40}$/.test(commit) || git("rev-parse", "HEAD").toString().trim() !== commit) fail("Release commit must equal exact repository HEAD");
    if (git("status", "--porcelain", "--untracked-files=all").toString().trim()) fail("Release requires clean working tree, including untracked files");
    const files = git("ls-tree", "-r", "--name-only", "-z", commit).toString("utf8").split("\0").filter(Boolean);
    const tracked = new Set(files);
    const evidence = (name) => {
        if (!nonempty(name) || !tracked.has(name) || !git("show", `${commit}:${name}`).toString().trim()) fail(`Missing tracked evidence: ${name || "(empty)"}`);
    };
    const releaseEvidence = (reference, expected = {}) => {
        if (!reference || !nonempty(reference.localPath) || !/^[0-9a-f]{64}$/.test(reference.sha256)) fail("Release evidence requires localPath and SHA256");
        const path = realpathSync(isAbsolute(reference.localPath) ? reference.localPath : resolve(dirname(manifest), reference.localPath));
        const within = relative(realpathSync(root), path);
        if (within !== ".." && !within.startsWith(`..${sep}`) && !isAbsolute(within)) fail("Version verification evidence must be outside source repository");
        const bytes = readFileSync(path);
        if (hash(bytes) !== reference.sha256) fail("Release evidence SHA256 mismatch");
        const record = JSON.parse(bytes.toString("utf8"));
        if (record.sourceRepository !== repository) fail("Release evidence repository mismatch");
        if (record.sourceCommit !== commit) fail("Release evidence commit mismatch");
        if (!nonempty(record.reviewer) || !nonempty(record.reviewedAt) || !Number.isFinite(Date.parse(record.reviewedAt)) || !nonempty(record.summary)) fail("Release evidence requires reviewer, valid reviewedAt and summary");
        for (const [key, value] of Object.entries(expected)) if (record[key] !== value) fail(`Release evidence ${key} mismatch`);
    };
    for (const kind of kinds) for (const path of data.sourceScope[kind]) {
        if (!tracked.has(path)) fail(`Source scope must contain exact tracked file: ${kind}/${path}`);
    }
    for (const name of ["serve.js", "app.js", "index.html", "redesign.css"]) {
        if (!Object.values(data.sourceScope).flat().includes(name)) fail(`Required runtime source missing: ${name}`);
    }
    for (const item of data.materials) {
        if (item.status !== "approved" || item.source === "unknown" || item.license === "unknown") fail(`Unapproved material: ${item.id}`);
        evidence(item.evidence);
    }
    for (const review of reviews) {
        if (data.reviews[review].status !== "approved") fail(`Unapproved review: ${review}`);
        releaseEvidence(data.reviews[review].evidence, ["sourceAccess", "rebuild"].includes(review) ? { sourceArchiveSha256: data.release.archive.sha256 } : {});
    }
    if (!Array.isArray(data.licenseFiles) || !data.licenseFiles.length) fail("License and notices are required");
    data.licenseFiles.forEach(evidence);
    const publicUrl = (value) => {
        let url;
        try { url = new URL(value); } catch { fail("Invalid public URL"); }
        if (url.protocol !== "https:" || url.username || url.password || url.hash || url.hostname === "localhost") fail("Expected public HTTPS URL without credentials");
    };
    const archive = data.release.archive;
    publicUrl(archive.url);
    publicUrl(data.release.sourceEntryUrl);
    releaseEvidence(archive.verificationEvidence, { sourceArchiveSha256: archive.sha256 });
    if (!/^[0-9a-f]{64}$/.test(archive.sha256) || !nonempty(archive.localPath)) fail("Archive SHA256 and local path are required");
    const bytes = readFileSync(isAbsolute(archive.localPath) ? archive.localPath : resolve(dirname(manifest), archive.localPath));
    if (hash(bytes) !== archive.sha256 || hash(git("-c", "core.autocrlf=false", "-c", "core.eol=lf", "archive", "--format=tar", commit)) !== archive.sha256) fail("Archive must equal canonical complete git archive of release commit");
    for (const kind of kinds) {
        const matches = data.release.artifacts.filter((item) => item.kind === kind);
        if (!matches.length) fail(`Missing artifact mapping: ${kind}`);
        for (const item of matches) {
            if (item.sourceCommit !== commit || !/^sha256:[0-9a-f]{64}$/.test(item.digest) || !nonempty(item.name)) fail(`Invalid artifact mapping: ${kind}`);
            if (!nonempty(item.localPath)) fail(`Missing local artifact: ${kind}`);
            const local = isAbsolute(item.localPath) ? item.localPath : resolve(dirname(manifest), item.localPath);
            if (`sha256:${hash(readFileSync(local))}` !== item.digest) fail(`Artifact digest mismatch: ${kind}`);
            releaseEvidence(item.verificationEvidence, { artifactDigest: item.digest });
        }
    }
    if (data.release.artifacts.some((item) => !kinds.includes(item.kind))) fail("Unknown artifact kind");
    const provenance = checkPublicSnapshot({
        cwd: root, component: "gateway", proofBytes: Buffer.from(snapshotProof || "", "utf8"),
        trustedSha256: snapshotProofSha256, expectedCommit: commit, expectedRepository: repository,
    });
    if (data.release.snapshotProofSha256 !== provenance.proofSha256 ||
        data.release.applicationCommit !== provenance.peerCommit) fail("Release record must bind trusted two-repository snapshot proof");
    return { mode, releaseApproved: false, message: "Local release evidence checks passed; operator must verify published bytes, deployed inventory, rights, and cross-repository release approval" };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const mode = args.shift() || "structure";
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const manifest = resolve(args.shift() || resolve(root, "docs/open-source/governance.json"));
    if (args.length) fail("Usage: node scripts/check-open-source.mjs [structure|release] [manifest.json]");
    try { console.log(JSON.stringify(checkOpenSource({ root, manifest, mode }))); }
    catch (error) { console.error(`GoldCube source gate: ${error.message}`); process.exitCode = 1; }
}
