# path-alias 
## 介绍
一个提供路径别名的提示语跳转的vscode插件

## Features
  - 可以自定义路径别名，在设置`pathAlias.aliasMap`中配置，key是你要定义的别名，value是路径别名所对应的绝对路径。其中可以使用`${cwd}`来代替当前工作目录的绝对路径。比方说，我想用`@` 代表我工作目录下的src目录那么我只用在配置中写
    ```json
    {
      "@": "${cwd}/src"
    }
    ```
    即可
    ![config](https://user-gold-cdn.xitu.io/2019/9/27/16d71c9f982aa567?w=2072&h=1271&f=gif&s=331895)
  - 提供路径别名的输入提示
    ![completion](https://user-gold-cdn.xitu.io/2019/9/27/16d71c9f8ac25a02?w=2072&h=1271&f=gif&s=402065)
  - 提供路径别名的文件跳转
  - ![defination](https://user-gold-cdn.xitu.io/2019/9/27/16d71ca148be8e56?w=2072&h=1271&f=gif&s=415196)
  -  路径别名更新后会自动更新相应提示
  - 添加文件和删除文件后会自动更新相应的提示
  - 对于一些路径的简写可以正确跳转
  - 支持从路径别名中import属性或者函数
  - ![multiline-import](https://user-gold-cdn.xitu.io/2019/9/27/16d71ca2bf87f38e?w=1425&h=780&f=gif&s=181618)
  - 支持从相对路径到路径别名的重构
  - ![refactor](https://user-gold-cdn.xitu.io/2019/9/27/16d71ca03dc9a2fd?w=1425&h=780&f=gif&s=138859)
  - 支持import变量的跳转
  - ![import-defination](https://user-gold-cdn.xitu.io/2019/9/27/16d71c9fb0a4aea3?w=1425&h=776&f=gif&s=377609)
  - 支持组件标签跳转。
  ![html-tag-defination](https://vuethisstore.flatpeach.xyz/html-tag-defination.gif)
  - 添加配置文件可以通过package.json 字段pathalias 或者在根目录下的.pathaliasrc(以json格式书写)配置路径别名
  - 提供对从路径别名中引入的函数的signature help 
  ![path-alias-signature](https://vuethisstore.flatpeach.xyz/pathaliassignature.gif)