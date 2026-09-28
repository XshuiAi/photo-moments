# 2026-09-28 公开样例验收

- `python3 -m unittest discover -s tests -v`：8 项路径、符号链接、已有目录、失败及中断保护测试通过。
- 在 `assets/template` 运行 `node verify.cjs`、`node verify-library.cjs`、`node verify-music.cjs`、`node verify-photo-management.cjs`、`node verify-live.cjs`、`node verify-public-samples.cjs`：通过。旅行音乐期望更新为5首，人物8首。
- 浏览器全新存储首次载入：人物39张、3组实况；IMG_1244样例视频2.878秒、readyState=4、播放中、未静音。
- 公开样例加载失败不写入半成品；现有相册不重复补回；新建custom相册保持空白。
- 静态复核：新增素材路径固定在assets/public-samples，目录及类型白名单；无shell命令插值、删除或上传个人相册逻辑。
- 用户在了解两脚本用途后明确授权公开当前照片、实况及音乐样例。本次依照该明确授权公开；不将AI复核声称为独立人工代码复核。

# V1 测试记录

## 2026-09-28 更新验证

- 五组 Node 回归（verify、library、music、photo-management、live）通过；人物 8 首、旅行 4 首。
- `python3 -m unittest discover -s tests -v`：8 项通过；`git diff --check` 通过。
- 浏览器验证新 Amazon、Try、爱的主打歌均进入播放态，时长 35 秒。三组用户实况刷新后保留，可播放视频与未静音音轨；用户素材不进入模板。
- 待关联列表支持预览、选择照片、关联和删除；视频内容去重回归通过。
- 静态检查：HEIC 后备解码仅处理本次请求临时目录内的固定文件；外部文件名不作为命令或输出路径，无递归删除或 shell=True。复制脚本仍拒绝覆盖。
- 音乐剪辑区间记录在 music-catalog.json 与 ATTRIBUTION.md；未声称完成听辨或独立版权审核。
- 按用户要求不进行豆包实机测试；仓库继续私有，独立人工安全复核未完成。

2026-09-27，本地 Python 3.9 / Node 26。

- `python3 tests/test_create_project.py`：8 项通过。覆盖路径穿越、绝对路径、危险名称、已有目录、符号链接、安装目录内输出、校验失败、中断保留已有文件、重复创建与完整复制。
- Skill YAML 校验通过。
- 在 `assets/template` 运行 `node verify.cjs`、`node verify-library.cjs`、`node verify-music.cjs`、`node verify-photo-management.cjs`：通过。
- 浏览器独立端口验证：首次署名、78 张旅行示例、36 张人物图片、漫剧 5 首音乐、随机播放、歌单显示当前播放、滚轮展开、放大查看、下一张 1/36 → 2/36。
- 文件扫描未发现绝对个人路径或凭证字段。复制脚本不提供覆盖/清理参数，无递归删除；只删除本次创建且已为空的临时目录。
- 仅私有测试发布。尚未经豆包实机测试或独立人工代码复核，不据此宣称适合公开发布。

2026-09-27 文档更新：8 项复制脚本回归与 Skill 格式检查通过；本地文档链接有效。新增两组实际页面采集 GIF 和 H.264/AAC MP4，并检查静帧构图。代码与文档 MIT，示例媒体单独保留权利说明。

2026-09-27 交互更新：四组 Node 回归与八项复制测试通过。浏览器验证主题重命名及刷新保留、大图翻页（7/36 → 8/36）、漫剧歌单仅四首且没有 Amazon。大图高度由约 54% 提升至约 74%（1163×654 测试视口）。
