# path-alias 
##介绍
一个提供路径别名的提示语跳转的vscode插件

## Features
  - 可以自定义路径别名，在设置`pathAlias.aliasMap`中配置，key是你要定义的别名，value是路径别名所对应的绝对路径。其中可以使用`${cwd}`来代替当前工作目录的绝对路径。比方说，我想用`@` 代表我工作目录下的src目录那么我只用在配置中写
    ```json
    {
      "@": "${cwd}/src"
    }
    ```
    即可
    ![config](https://vuethisstore.flatpeach.xyz/path-alias-config.gif)
  - 提供路径别名的输入提示
    ![completion](https://vuethisstore.flatpeach.xyz/path-alias-completion.gif)
  - 提供路径别名的文件跳转
  - ![defination](https://vuethisstore.flatpeach.xyz/path-alias-defination.gif)
  -  路径别名更新后会自动更新相应提示
  - 添加文件和删除文件后会自动更新相应的提示
  - 对于一些路径的简写可以正确跳转

## TODO
- [ ] 提供import提示  
- [ ] 提供import跳转  
- [ ] 提供将相对路径转化为path alias 的重构功能
