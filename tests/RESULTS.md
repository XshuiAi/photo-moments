# V1 测试记录

2026-09-27，本地 Python 3.9 / Node 26。

- `python3 tests/test_create_project.py`：8 项通过。覆盖路径穿越、绝对路径、危险名称、已有目录、符号链接、安装目录内输出、校验失败、中断保留已有文件、重复创建与完整复制。
- Skill YAML 校验通过。
- 在 `assets/template` 运行 `node verify.cjs`、`node verify-library.cjs`、`node verify-music.cjs`、`node verify-photo-management.cjs`：通过。
- 浏览器独立端口验证：首次署名、78 张旅行示例、36 张人物图片、漫剧 5 首音乐、随机播放、歌单显示当前播放、滚轮展开、放大查看、下一张 1/36 → 2/36。
- 文件扫描未发现绝对个人路径或凭证字段。复制脚本不提供覆盖/清理参数，无递归删除；只删除本次创建且已为空的临时目录。
- 仅私有测试发布。尚未经豆包实机测试或独立人工代码复核，不据此宣称适合公开发布。
