import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkOpenSource } from "./check-open-source.mjs";

function fixture() {
    const temp = mkdtempSync(join(tmpdir(), "goldcube-source-gate-"));
    const root = join(temp, "repo");
    execFileSync("git", ["init", "--quiet", root]);
    const git = (...args) => execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    git("config", "user.name", "Fixture"); git("config", "user.email", "fixture@example.invalid");
    git("config", "core.autocrlf", "false"); git("config", "core.eol", "lf");
    for (const name of ["serve.js", "app.js", "index.html", "redesign.css", "logo.svg", "deploy.mjs", "LICENSE", "NOTICE", "THIRD_PARTY_NOTICES", "README.md", "review.md", "许可说明.md"]) writeFileSync(join(root, name), `fixture ${name}\n`);
    git("add", "."); git("commit", "--quiet", "-m", "fixture");
    const commit = git("rev-parse", "HEAD").toString().trim();
    const bytes = git("-c", "core.autocrlf=false", "-c", "core.eol=lf", "archive", "--format=tar", commit);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const archive = join(temp, "source.tar"); writeFileSync(archive, bytes);
    const evidence = "review.md";
    const record = { sourceRepository: "fandy20082008/GoldCube-Gateway", sourceCommit: commit, sourceArchiveSha256: sha256, artifactDigest: `sha256:${sha256}`, reviewer: "Fixture reviewer", reviewedAt: "2026-09-22T08:00:00Z", summary: "Isolated fixture evidence, not production approval" };
    const external = { localPath: join(temp, "verification.json"), sha256: "" };
    const writeEvidence = () => { const body = JSON.stringify(record); writeFileSync(external.localPath, body); external.sha256 = createHash("sha256").update(body).digest("hex"); };
    writeEvidence();
    const data = {
        schemaVersion: 1, repository: "fandy20082008/GoldCube-Gateway", applicationRepository: "fandy20082008/GoldCube",
        materials: [{ id: "fixture", scope: "all", source: "fixture independent source", license: "fixture license", status: "approved", evidence }],
        sourceScope: { proxy: ["serve.js"], shell: ["app.js", "index.html", "redesign.css"], assets: ["logo.svg"], deployment: ["deploy.mjs"] },
        licenseFiles: ["LICENSE", "许可说明.md"],
        reviews: Object.fromEntries(["provenance", "licenses", "materials", "secrets", "sourceAccess", "rebuild", "deploymentInventory"].map((name) => [name, { status: "approved", evidence: external }])),
        release: { commit, sourceEntryUrl: "https://example.invalid/source", archive: { localPath: archive, url: "https://example.invalid/source.tar", sha256, verificationEvidence: external }, artifacts: ["proxy", "shell", "assets", "deployment"].map((kind) => ({ kind, name: `fixture-${kind}`, sourceCommit: commit, digest: `sha256:${sha256}`, localPath: archive, verificationEvidence: external })) },
    };
    const proof = { schemaVersion: 1, kind: "public-snapshot", baseline: "04b32d31ca00272e3866c85e9a8329036c63af72",
        review: { decision: "approved", reviewer: "Fixture", reviewedAt: "2026-09-24T00:00:00Z" },
        snapshots: {
            application: { repository: "fandy20082008/GoldCube", developmentCommit: "a".repeat(40), developmentTree: "b".repeat(40), baselineEvidenceSha256: "c".repeat(64), reviewedScopeSha256: "d".repeat(64), commit: "e".repeat(40), rootCommit: "e".repeat(40), tree: "f".repeat(40), membersSha256: "1".repeat(64), archiveSha256: "2".repeat(64), licenseBlob: "29ebfa545f5580919a4e884d7014d7a3eb2df762" },
            gateway: { repository: "fandy20082008/GoldCube-Gateway", developmentCommit: "a".repeat(40), developmentTree: "b".repeat(40), baselineEvidenceSha256: "c".repeat(64), reviewedScopeSha256: "d".repeat(64), commit, rootCommit: commit, tree: git("rev-parse", "HEAD^{tree}").toString().trim(), membersSha256: createHash("sha256").update(git("ls-tree", "-rz", "HEAD")).digest("hex"), archiveSha256: sha256, licenseBlob: git("rev-parse", "HEAD:LICENSE").toString().trim() },
        },
    };
    const proofBytes = JSON.stringify(proof);
    const proofSha256 = createHash("sha256").update(proofBytes).digest("hex");
    data.release.snapshotProofSha256 = proofSha256;
    data.release.applicationCommit = proof.snapshots.application.commit;
    const manifest = join(temp, "manifest.json");
    return { root, git, bytes, data, record, external, writeEvidence, write: () => writeFileSync(manifest, JSON.stringify(data)), check: (mode = "release", proofInput = proofBytes, hashInput = proofSha256) => checkOpenSource({ root, manifest, mode, snapshotProof: proofInput, snapshotProofSha256: hashInput }), dispose: () => rmSync(temp, { recursive: true, force: true }) };
}

const cases = [
    ["complete isolated fixture passes local checks only", () => {}, null],
    ["main application repository cannot stand in for Gateway", (f) => { f.data.repository = "fandy20082008/GoldCube"; }, /exact Gateway and application repository mapping/],
    ["wrong owner blocks release", (f) => { f.data.repository = "other/GoldCube-Gateway"; }, /exact Gateway and application repository mapping/],
    ["wrong application mapping blocks release", (f) => { f.data.applicationRepository = "csyqlz/VOZEB-PRO"; }, /exact Gateway and application repository mapping/],
    ["wrong evidence repository blocks release", (f) => { f.record.sourceRepository = "fandy20082008/GoldCube"; f.writeEvidence(); }, /evidence repository mismatch/],
    ["unknown provenance blocks release", (f) => { f.data.reviews.provenance.status = "unknown"; }, /Unapproved review/],
    ["unknown material blocks release", (f) => { f.data.materials[0].status = "unknown"; }, /Unapproved material/],
    ["wrong commit blocks release", (f) => { f.data.release.commit = "0".repeat(40); }, /exact repository HEAD/],
    ["missing deployment source blocks release", (f) => { f.data.sourceScope.deployment = ["absent.sh"]; }, /exact tracked file/],
    ["missing evidence blocks release", (f) => { f.data.reviews.licenses.evidence = {}; }, /localPath and SHA256/],
    ["wrong evidence commit blocks release", (f) => { f.record.sourceCommit = "0".repeat(40); f.writeEvidence(); }, /evidence commit mismatch/],
    ["modified evidence bytes block release", (f) => { writeFileSync(f.external.localPath, "{}"); }, /evidence SHA256 mismatch/],
    ["missing reviewer blocks release", (f) => { f.record.reviewer = ""; f.writeEvidence(); }, /requires reviewer/],
    ["invalid review time blocks release", (f) => { f.record.reviewedAt = "unknown"; f.writeEvidence(); }, /valid reviewedAt/],
    ["in-repository version evidence is rejected", (f) => { f.external.localPath = join(f.root, "review.md"); }, /outside source repository/],
    ["wrong reviewed archive blocks release", (f) => { f.record.sourceArchiveSha256 = "0".repeat(64); f.writeEvidence(); }, /sourceArchiveSha256 mismatch/],
    ["missing artifact category blocks release", (f) => { f.data.release.artifacts.pop(); }, /Missing artifact mapping/],
    ["wrong archive hash blocks release", (f) => { f.data.release.archive.sha256 = "0".repeat(64); f.record.sourceArchiveSha256 = "0".repeat(64); f.writeEvidence(); }, /Archive must equal/],
    ["wrong artifact bytes block release", (f) => { f.data.release.artifacts[0].digest = `sha256:${"0".repeat(64)}`; }, /Artifact digest mismatch/],
    ["missing license blocks release", (f) => { f.data.licenseFiles = []; }, /License and notices/],
    ["untracked build input blocks release", (f) => { writeFileSync(join(f.root, "untracked.js"), "fixture"); }, /clean working tree/],
];
for (const [name, mutate, error] of cases) test(name, () => {
    const f = fixture();
    try { mutate(f); f.write(); if (error) assert.throws(() => f.check(), error); else assert.equal(f.check().releaseApproved, false); }
    finally { f.dispose(); }
});
test("structure check permits explicit unknowns without release approval", () => {
    const f = fixture();
    try { f.data.reviews.provenance.status = "unknown"; f.data.release.commit = ""; f.write(); assert.equal(f.check("structure").releaseApproved, false); }
    finally { f.dispose(); }
});
test("structure rejects absent inventory", () => {
    const f = fixture();
    try { f.data.materials = []; f.write(); assert.throws(() => f.check("structure"), /Material inventory/); }
    finally { f.dispose(); }
});
test("structure rejects ambiguous local repository name", () => {
    const f = fixture();
    try { f.data.repository = "GoldCube"; f.write(); assert.throws(() => f.check("structure"), /exact Gateway and application repository mapping/); }
    finally { f.dispose(); }
});
test("release fails closed without an externally pinned public snapshot proof", () => {
    const f = fixture();
    try { f.write(); assert.throws(() => f.check("release", ""), /公开快照来源阻断/); }
    finally { f.dispose(); }
});

test("fixed LF archive remains canonical across autocrlf and eol configurations", () => {
    const f = fixture();
    try {
        f.write();
        for (const autocrlf of ["true", "false"]) for (const eol of ["lf", "crlf", "native"]) {
            f.git("config", "core.autocrlf", autocrlf);
            f.git("config", "core.eol", eol);
            assert.equal(f.check().releaseApproved, false, `autocrlf=${autocrlf}, eol=${eol}`);
            assert.deepEqual(f.git("-c", "core.autocrlf=false", "-c", "core.eol=lf", "archive", "--format=tar", f.data.release.commit), f.bytes);
        }
    } finally { f.dispose(); }
});

for (const kind of ["old CRLF conversion", "tampered bytes"]) test(`canonical archive rejects ${kind} even with matching declared hashes`, () => {
    const f = fixture();
    try {
        f.git("config", "core.autocrlf", "true");
        f.git("config", "core.eol", "crlf");
        const bytes = kind === "old CRLF conversion" ? f.git("archive", "--format=tar", f.data.release.commit) : Buffer.concat([f.bytes, Buffer.from("tampered")]);
        assert.notDeepEqual(bytes, f.bytes, "fixture must actually change archive bytes");
        const sha256 = createHash("sha256").update(bytes).digest("hex");
        writeFileSync(f.data.release.archive.localPath, bytes);
        f.data.release.archive.sha256 = sha256;
        f.record.sourceArchiveSha256 = sha256;
        f.record.artifactDigest = `sha256:${sha256}`;
        for (const artifact of f.data.release.artifacts) artifact.digest = `sha256:${sha256}`;
        f.writeEvidence(); f.write();
        assert.throws(() => f.check(), /Archive must equal canonical/);
    } finally { f.dispose(); }
});
