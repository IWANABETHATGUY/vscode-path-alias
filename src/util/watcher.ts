import * as chikdar from 'chokidar';
import { eventBus } from '..';

export function generateWatcher(path: string) {
  const watcher = chikdar.watch(path, {
    ignored: ['**/node_modules/**'],
  });
  let ready = false;
  watcher
    .on('ready', function () {
      ready = true;
    })
    .on('add', function (path) {
      if (ready) {
        eventBus.emit('file-change', path);
      }
    })
    .on('unlink', function (path) {
      eventBus.emit('file-change', path);
    });
  return watcher;
}
