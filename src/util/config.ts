/**
 * 包含从文件中提取pathalias的相关函数
 */
import * as path from 'path';
import * as fs from 'fs';
export interface Config {
  [alias: string]: string;
}
export function getConfigFromPathaliasrc(
  file: string,
  rootPath: string
): Config {
  let config: Config = {};
  try {
    const configJson = JSON.parse(file);
    Object.keys(configJson).reduce((pre, cur) => {
      pre[cur] = configJson[cur].replace('${cwd}', rootPath);
      return pre;
    }, config);
  } catch (error) {
    config = {};
    console.log(error);
  }
  return config;
}

export function getConfigFromPackageJson(
  file: string,
  rootPath: string
): Config {
  let config: Config = {};
  try {
    const packageJson = JSON.parse(file);
    const initConfig = packageJson['pathalias'];
    if (initConfig) {
      Object.keys(initConfig).reduce((pre, cur) => {
        pre[cur] = initConfig[cur].replace('${cwd}', rootPath);
        return pre;
      }, config);
    }
  } catch (error) {
    config = {};
    console.log(error);
  }
  return config;
}

export function getAliasConfig(rootPath: string): Config {
  let config: Config = {};
  const packageJsonPath = path.resolve(rootPath, 'package.json');
  const pathaliasrc = path.resolve(rootPath, '.pathaliasrc');
  let fileContent = '';
  if (fs.existsSync(packageJsonPath)) {
    fileContent = fs.readFileSync(packageJsonPath).toString();
    config = getConfigFromPackageJson(fileContent, rootPath);
  }
  if (fs.existsSync(pathaliasrc)) {
    fileContent = fs.readFileSync(pathaliasrc).toString();
    config = {
      ...config,
      ...getConfigFromPathaliasrc(fileContent, rootPath)
    };
  }
  return config;
}
