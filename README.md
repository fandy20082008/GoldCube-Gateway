# 金立方 GoldCube

> 全新品牌 UI 版：以新版设计（redesign 原型）为皮肤，品牌化为 **金立方 GoldCube**。
> 静态品牌外壳（HTML + CSS + JS）与 Node HTTP 代理；登录、API 和应用页面依赖单独部署的主应用。

本仓库对应 [GoldCube-Gateway](https://github.com/fandy20082008/GoldCube-Gateway)。主应用对应 [GoldCube](https://github.com/fandy20082008/GoldCube)，基于 VOZEB-PRO 固定旧 AGPL 基线 `04b32d31ca00272e3866c85e9a8329036c63af72` 持续二开。两仓须按发布清单绑定精确提交、源码归档哈希与实际制品。

## 页面

- 公开页：index（首页）· login · register · forgot-password · gallery（作品广场）· announcements（公告）· terms · privacy
- 应用页：create（创作工作台）· canvas（画布）· canvas-detail（画布详情）· drama（短剧）· drama-detail（短剧详情）· assets（素材）· works（作品）· community（社区）· prompts（提示词）· my-prompts（词库）· profile（个人中心）· billing（套餐中心）· billing-checkout/cancel/success（结算）· help（帮助）· me（主页）

## 品牌与 Logo

- 站点标题 / 页脚 / SEO：金立方 GoldCube
- Logo / icon：`logo.svg` / `icon.svg`；项目负责人已声明品牌素材为自有创作，具体素材公开权利仍按逐文件清单复核。
- 主题：默认浅色，右上角一键切换深色；localStorage key `goldcube-theme`
- 动效：首屏 stagger、极光视差、粒子上浮、3X 输入框光晕、主题角色小精灵（hover 眼睛追踪）

## 运行

```bash
node serve.js   # http://localhost:3301
```

需要 Node.js 及可访问的主应用后端。`PORT` 默认 `3301`，`GOLDCUBE_BACKEND_HOST` 默认 `127.0.0.1`，`GOLDCUBE_BACKEND_PORT` 默认 `3300`。按实际环境配置这些变量；生产秘密不应写入源码或发布包。

`serve.js` 提供本地页面与 API/应用页面代理，并包含品牌 DOM/CSS 适配、Next 资源及 URL 重写；不是仅提供静态文件的服务器。直接打开 HTML 仅可预览部分原型，不能替代完整登录和 API 部署。以上启动说明不是已完成的生产部署验收。

生产服务、Nginx 反代及版本回滚所需的脱敏模板和说明见 [deploy/README.md](deploy/README.md)；实际环境值与制品绑定仍须按发布清单验收。

## 设计

首发源码包不分发 17 张非运行所需预览截图；页面运行不依赖它们。旧版截图及重拍证据只留在私有开发历史中。首页三张插画由本仓库内的原生 SVG 绘制文件提供，不再引用原有 AI 生成图片。

页面主题、字体和交互样式位于 `redesign.css`、`app.js` 及各 HTML 页面中；内部设计评审记录不属于此源码快照。

---
© 2026 金立方 GoldCube.

## 许可

本仓库 GoldCube 自有源代码采用 **GNU Affero General Public License version 3 only（AGPL-3.0-only）**，详见 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)。主应用及第三方材料保留各自原版权与许可，见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES)。自有代码许可不自动覆盖未核清的图片、字体、图标或截图；当前未决材料与历史审核仍阻断相关候选公开。

此许可允许依其条件使用、修改和再分发，包括商业使用；不宣称本项目是上游官方产品，也不额外授予商标权。具体运行版本的完整对应源码以经过验收的双仓发布清单及源码入口为准，浮动仓库链接不能替代版本供源。

## 管理边界

- GoldCube 主站不提供管理后台页面，也不提供独立的链接管理入口。
- `admin.html`、`admin-setup.html` 及兼容路径均不对外暴露；管理能力仅保留在原版 VOZEB PRO 服务侧，需按原版部署与权限策略访问。
- 历史交叉验证记录保存在私有开发资料中，不属于此源码快照。
