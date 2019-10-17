export class LRU<T extends { id: string }> {
  public _list: T[] = [];
  private _maxLength: number;
  constructor(list?: T[], maxLength: number = 10) {
    this._maxLength = maxLength;
    if (list) {
      if (list.length > maxLength) {
        console.warn(
          `maxLength is ${maxLength}, your list length is ${list.length}`
        );
        list = list.slice(0, maxLength);
      }
      this._list.push(...list);
    }
  }
  get(name: string): T | null {
    let index = this._list.findIndex(item => item.id === name);
    if (index !== -1) {
      const item = this._list.splice(index, 1)[0];
      this._list.push(item);
      return item;
    }
    return null;
  }
  push(item: T): void {
    while (this._list.length >= this._maxLength) {
      this._list.shift();
    }
    this._list.push(item);
  }
}
