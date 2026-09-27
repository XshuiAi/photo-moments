# 安装 Photo Moments

[返回作品介绍](../README.md)

## 先准备

- 下载 [Photo-Moments.zip](https://github.com/XshuiAi/photo-moments/releases/latest)，或通过有权限的 GitHub 账号获取完整仓库。
- 使用能读取技能、操作文件和运行项目的 Agent。
- 项目运行需要 Python 3.9+；核心网页不需要 npm、API Key 或联网加载示例素材。

## 豆包工作

1. 打开“技能”管理入口，选择“新建 → 上传技能”。
2. 按当前界面支持的格式上传 ZIP；需要目录时，选择解压后内含 `SKILL.md` 的 `photo-moments` 文件夹。
3. 新建工作任务，选择 Photo Moments。
4. 发送下面的启动口令。成功后应拿到网页入口，而不只是文字介绍或一张截图。

```text
使用 Photo Moments，先原样运行完整模板，不重新设计。
保留旅行和心动漫剧两个案例的照片、音乐和交互。
请生成独立项目副本，启动预览，并给我可打开的入口。
```

豆包若提示包过大，先保留完整包；可改为让已授权的 GitHub 连接器读取仓库。只让它读 README 或 SKILL.md 不够，还需要模板及素材文件。如果环境不能下载或运行服务，请让它明确指出缺失能力，不要接受虚构链接。

[豆包工作官方技能说明](https://www.doubao.com/work/docs/zh-cn/articles/081010973544-skills)。

## WorkBuddy

进入技能页面，点击添加技能，通过本地技能包导入完整文件夹或 ZIP；界面可能随版本变化。新建任务后选择 Photo Moments，使用上面的同一段口令。

若由 Agent 安装，提供仓库地址并要求“读取 SKILL.md，保留所有 assets 与 scripts，安装完成后运行完整模板”。仓库需要访问权限。

[WorkBuddy 官方技能说明](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market)。

## Codex

可以直接发给 Codex：

```text
请安装这个 Skill：https://github.com/XshuiAi/photo-moments
安装整个目录，保留 SKILL.md、scripts、assets、references 和 template-manifest.json。
若已经存在，不要覆盖我的修改，先检查现有版本。
```

安装后按宿主提示重新打开会话，再使用：

```text
$photo-moments 先做出内置的两个相册示例，启动网页预览。
```

手动安装时，将完整目录放入当前 Codex 配置的 Skill 目录；默认安装器使用 `~/.codex/skills/`，部分环境使用 `~/.agents/skills/`。以当前技能列表实际识别结果为准，不必重复安装到多个目录。

## Claude Code

把完整目录放到 `~/.claude/skills/photo-moments/`，确保下面这份文件存在：

```text
~/.claude/skills/photo-moments/SKILL.md
```

目标目录尚不存在时，可用 Git 克隆：

```sh
git clone https://github.com/XshuiAi/photo-moments.git ~/.claude/skills/photo-moments
```

私有仓库需要已有的 GitHub 登录权限。不要强制覆盖同名目录。

在新会话中调用：

```text
/photo-moments 先完整运行内置示例，给我网页预览，然后再改成我的相册。
```

[Claude Code 官方技能说明](https://code.claude.com/docs/en/skills)。

## 不安装 Skill，手动运行网页

解压完整包后，也可以直接进入 `assets/template` 执行：

```sh
python3 server.py --port 4180
```

Windows 可使用已安装的 Python 对应命令，例如 `py -3 server.py --port 4180`。然后在同一台机器的浏览器打开：

```text
http://127.0.0.1:4180/
```

如果还要修改，推荐先在独立工作目录执行：

```sh
python3 /完整路径/photo-moments/scripts/create_project.py --name my-moments
cd photo-moments-output/my-moments
python3 server.py --port 4180
```

将第一行的路径换成自己的实际解压位置。脚本只能创建新目录；存在同名项目时，换一个名字，不会覆盖原项目。

端口占用时可改为 4181，再打开对应地址。服务进程需要保持运行。云端 Agent 若提供端口预览，应使用平台返回的实际地址；本项目本身不会自动生成公网链接。

## 打开后的核对

- 左上角能切换“我的旅行”和“心动漫剧”。
- 旅行示例为 78 张，人物示例为 36 张。
- 拖动能旋转；下滚展开，上滚可合拢。
- 照片能放大并左右切换。
- 点击随机播放有音乐；旅行和人物歌单分别为 4 首和 5 首。
- 可以输入自己的署名，创建新的空白相册。

这些数字对应内置模板。添加或删除自己的素材后，数量自然会变化。多平台实机导入状态见 README 的兼容性说明。
