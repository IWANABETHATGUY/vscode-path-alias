# path-alias 
[中文](https://github.com/IWANABETHATGUY/vscode-path-alias/blob/master/README.md)|English
## Introduction
A vscode plugin that provides path alias completion, jump, reconstruction, automatic function introduction, function signature help
## Features
  - You can customize the path alias, configure it in the setting `pathAlias.aliasMap`, the key is the alias you want to define, and the value is the absolute path corresponding to the path alias. Which can use `${cwd}` to replace the absolute path of the current working directory. For example, I want to use `@` to represent the src directory under my working directory, so I only write in the configuration
    ```json
    {
      "@": "${cwd}/src"
    }
    ```
    ![config](https://github.com/IWANABETHATGUY/vscode-path-alias/blob/master/assets/path-alias-config.gif?raw=true)
  - -Provide input prompt for path alias
    ![completion](https://github.com/IWANABETHATGUY/vscode-path-alias/blob/master/assets/path-alias-completion.gif?raw=true)
  - File jump with path alias
    ![defination](https://github.com/IWANABETHATGUY/vscode-path-alias/blob/master/assets/path-alias-defination.gif?raw=true)
  -  The corresponding prompt will be automatically updated after the path alias is updated
  - The corresponding prompt will be automatically updated after adding and deleting files
  - It can jump correctly for some path abbreviations
  - Support importing attributes or functions from path aliases
    ![multiline-import](https://github.com/IWANABETHATGUY/vscode-path-alias/blob/master/assets/path-alias-multiline-import.gif?raw=true)
  - Support refactor which convert relative path to path alias
    ![refactor](https://github.com/IWANABETHATGUY/vscode-path-alias/blob/master/assets/path-alias-refactor.gif?raw=true)
  - Support jump to definition the identifier import from path alias
    ![import-defination](https://github.com/IWANABETHATGUY/vscode-path-alias/blob/master/assets/path-alias-autoimport.gif?raw=true)
  - Support jump to component definition in `.vue`
  ![html-tag-defination](https://github.com/IWANABETHATGUY/vscode-path-alias/blob/master/assets/html-tag-defination.gif?raw=true)
  - Adding configuration files can configure path aliases through the `package.json` field pathalias or `.pathaliasrc` (written in json format) in the root directory
  - Provide signature help for functions introduced from path alias 
  ![path-alias-signature](https://github.com/IWANABETHATGUY/vscode-path-alias/blob/master/assets/pathaliassignature.gif?raw=true)
  - Provide auto import the function from path aliases
  ![path-alias-autoimport](https://github.com/IWANABETHATGUY/vscode-path-alias/blob/master/assets/path-alias-autoimport2.gif?raw=true)
  You can freely choose whether to turn on the selection prompt and automatically trigger the following prompt. `pathAlias.autoSuggestion` is turned on by default, if you need to turn it off, set it to false
