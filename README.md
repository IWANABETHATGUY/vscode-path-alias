# path-alias 
## 安装 
`ext install IWANABETHATGUY.path-alias`
或者 在你的 vscode 插件栏搜索 `path-alias` 
中文|[English](https://github.com/IWANABETHATGUY/vscode-path-alias/blob/master/README.EN.md)
## 介绍
一个提供路径别名补全，跳转,重构,函数自动引入，函数signature help  的vscode 插件
## Features
  - 可以自定义路径别名，在设置`pathAlias.aliasMap`中配置，key是你要定义的别名，value是路径别名所对应的绝对路径。其中可以使用`${cwd}`来代替当前工作目录的绝对路径。比方说，我想用`@` 代表我工作目录下的src目录那么我只用在配置中写
    ```json
    {
      "@": "${cwd}/src"
    }
    ```
    即可
    ![config](https://github.com/IWANABETHATGUY/vscode-path-alias/blob/master/assets/path-alias-config.gif?raw=true)
  - 提供路径别名的输入提示
    ![completion](https://github.com/IWANABETHATGUY/vscode-path-alias/blob/master/assets/path-alias-completion.gif?raw=true)
  - 提供路径别名的文件跳转
    ![defination](https://github.com/IWANABETHATGUY/vscode-path-alias/blob/master/assets/path-alias-defination.gif?raw=true)
  -  路径别名更新后会自动更新相应提示
  - 添加文件和删除文件后会自动更新相应的提示
  - 对于一些路径的简写可以正确跳转
  - 支持从路径别名中import属性或者函数
    ![multiline-import](https://github.com/IWANABETHATGUY/vscode-path-alias/blob/master/assets/path-alias-multiline-import.gif?raw=true)
  - 支持从相对路径到路径别名的重构
    ![refactor](https://github.com/IWANABETHATGUY/vscode-path-alias/blob/master/assets/path-alias-refactor.gif?raw=true)
  - 支持import变量的跳转
    ![import-defination](https://github.com/IWANABETHATGUY/vscode-path-alias/blob/master/assets/path-alias-autoimport.gif?raw=true)
  - 支持组件标签跳转。
  ![html-tag-defination](https://github.com/IWANABETHATGUY/vscode-path-alias/blob/master/assets/html-tag-defination.gif?raw=true)
  - 添加配置文件可以通过package.json 字段pathalias 或者在根目录下的.pathaliasrc(以json格式书写)配置路径别名
  - 提供对从路径别名中引入的函数的signature help 
  ![path-alias-signature](https://github.com/IWANABETHATGUY/vscode-path-alias/blob/master/assets/pathaliassignature.gif?raw=true)
  - 提供对从路径别名中函数自动导入功能
  ![path-alias-autoimport](https://github.com/IWANABETHATGUY/vscode-path-alias/blob/master/assets/path-alias-autoimport2.gif?raw=true)
  可以自由选择是否开启选择提示后自动触发后面的提示`pathAlias.autoSuggestion`默认开启，如需关闭自行设置为false
