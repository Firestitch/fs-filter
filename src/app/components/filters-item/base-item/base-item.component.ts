import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DoCheck,
  EventEmitter,
  Input,
  KeyValueDiffer,
  KeyValueDiffers, OnDestroy,
  Output
} from '@angular/core';

import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { BaseItem } from '../../../models/items/base-item';
import { IFilterConfigItem } from '../../../interfaces/config.interface';


@Component({
  selector: 'base-item',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BaseItemComponent<T extends BaseItem<IFilterConfigItem>> implements DoCheck, OnDestroy {

  @Input()
  set item(value: T) {
    this._item = value;
  };

  @Input()
  public inline = false;

  @Output()
  public itemChanged = new EventEmitter();

  protected _item: T;
  protected _kvDiffer: KeyValueDiffer<string, any>;
  protected _destroy$ = new Subject();

  private _debouncer$ = new Subject();

  constructor(
    protected _kvDiffers: KeyValueDiffers,
    protected _cd: ChangeDetectorRef
  ) {
    this._kvDiffer = this._kvDiffers.find(this.item || {}).create();
    this.listenWithDebounce();
  }

  get item(): T {
    return this._item
  }

  public ngDoCheck(): void {
    if (this._kvDiffer) {
      const changes = this._kvDiffer.diff(this.item);

      if (changes) {
        this._cd.detectChanges();
      }
    }
  }

  public ngOnDestroy() {
    this._destroy$.next();
    this._destroy$.complete();
  }

  public listenWithDebounce() {
    this._debouncer$
      .pipe(
        takeUntil(this._destroy$),
        debounceTime(300),
      )
      .subscribe(() => {
        if (this.item.change) {
          this.item.change(this.item);
        }

        this.itemChanged.next(this.item);
      })
  }

  public itemChange() {
    this._debouncer$.next();
  }
}
