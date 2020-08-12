import { Injectable, OnDestroy } from '@angular/core';

import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

import { pickBy } from 'lodash-es';

import { FilterSort, IFilterConfigItem } from '../interfaces/config.interface';
import { ItemType } from '../enums/item-type.enum';
import { BaseItem } from '../models/items/base-item';
import { SimpleSelectItem } from '../models/items/select/simple-select-item';
import { IFilterConfigSelectItem } from '../interfaces/items/select.interface';
import { FsFilterConfig, SORT_BY_FIELD, SORT_DIRECTION_FIELD } from '../models/filter-config';
import { createFilterItem } from '../helpers/create-filter-item';


@Injectable()
export class FsFilterItemsStore implements OnDestroy {

  public sortByItem: BaseItem<IFilterConfigItem> = null;
  public sortDirectionItem: BaseItem<IFilterConfigItem> = null;

  private _items: BaseItem<IFilterConfigItem>[] = [];
  private _visibleItems: BaseItem<IFilterConfigItem>[] = [];
  private _filtersNames = new Set<string>();

  private _hasKeyword = false;
  private _config: FsFilterConfig;

  private _itemsChange$ = new Subject();

  constructor() {
  }

  public get items(): BaseItem<IFilterConfigItem>[] {
    return this._items;
  }

  public get visibleItems(): BaseItem<IFilterConfigItem>[] {
    return this._visibleItems;
  }

  public get hasKeyword(): boolean {
    return this._hasKeyword;
  }

  public get itemsChange$() {
    return this._itemsChange$.pipe(debounceTime(30));
  }

  public ngOnDestroy() {
    this.items
      .forEach((item) => item.destroy());
    this.sortByItem?.destroy();
    this.sortDirectionItem?.destroy();
  }

  public setConfig(config) {
    this._config = config;
    this.initItems(config.items);
  }

  public initItems(items: IFilterConfigItem[]) {
    if (Array.isArray(items)) {
      this._createItems(items);
      this._updateVisibleItems();
    }
  }

  public filtersClear() {
    this.items.forEach((item) => {
      item.clear();
    });

    if (this.sortByItem) {
      if (this._config.sort) {
        this.sortByItem.model = this._config.sort.value
      } else {
        this.sortByItem.clear();
      }
    }

    if (this.sortDirectionItem) {
      if (this._config.sort) {
        this.sortDirectionItem.model = this._config.sort.direction
      } else {
        this.sortDirectionItem.clear();
      }
    }
  }

  public loadAsyncValues() {
    this.items
      .filter((item) => item.hasPendingValues)
      .forEach((item) => item.loadAsyncValues());
  }

  public getSort(): FilterSort {
    let sortBy = this.getSortByValue();
    sortBy = sortBy === '__all' ? null : sortBy;

    let sortDirection = this.getSortDirectionValue();
    sortDirection = sortDirection === '__all' ? null : sortDirection;

    return {
      value: sortBy,
      direction: sortDirection,
    }
  }

  public getSortByValue() {
    return this.sortByItem ? this.sortByItem.model : null;
  }

  public getSortDirectionValue() {
    return this.sortDirectionItem ? this.sortDirectionItem.model : null;
  }

  public updateSort(sort) {
    if (sort.sortBy) {
      this.sortByItem.model = sort.sortBy;
    }

    if (sort.sortDirection) {
      this.sortDirectionItem.model = sort.sortDirection;
    }
  }

  public values(onlyPresented = false): Record<string, unknown> {
    return this.items.reduce((acc, item) => {
      const value = item.value;

      if (!onlyPresented || value !== null) {
        acc[item.name] = value;
      }

      return acc;
    }, {});
  }

  public valuesAsQuery(onlyPresented = false): Record<string, unknown> {
    const params = {};

    this.items.forEach((filterItem: BaseItem<any>) => {
      Object.assign(params, filterItem.valueAsQuery);
    });

    if (onlyPresented) {
      return pickBy(params, (val) => {
        return val !== null && val !== void 0;
      });
    }

    return params;
  }


  private _createItems(items: IFilterConfigItem[]) {
    this._items = items
      .filter((item) => {
        if (this._filtersNames.has(item.name)) {
          throw Error('Filter init error. Items name must be unique.');
        } else {
          this._filtersNames.add(item.name);

          return true;
        }
      })
      .map((item) => {
        const filterItem = createFilterItem(item, { case: this._config.case });

        if (filterItem.type === ItemType.Keyword) {
          this._hasKeyword = true;
        }

        return filterItem;
      });

  }

  private _subscribeToItemsChanges() {
    this.items
      .forEach((item) => {
        item.valueChange$
          .pipe(
            // filter(() => item.initialized),
            // distinctUntilChanged(),
            takeUntil(item.destroy$)
          )
          .subscribe(() => {
            this._itemsChange$.next(item);
          })
      });

    if (this._config.sortValues) {
      this.sortByItem.valueChange$
        .pipe()
        .subscribe(() => {
          this._itemsChange$.next(this.sortByItem);
        });

      this.sortDirectionItem.valueChange$
        .pipe()
        .subscribe(() => {
          this._itemsChange$.next(this.sortDirectionItem);
        });
    }
  }

  private _updateVisibleItems() {
    this._visibleItems = this.items
      .filter((item) => !item.isTypeKeyword && !item.hide);
  }

  public _initItemValues(p) {
    this.items
      .forEach((item) => {
        item.initValues(p[item.name]);
      });

    this._createSortingItems(p);

    this._subscribeToItemsChanges();
  }

  private _createSortingItems(p) {
    if (this._config.sortValues) {
      const sortByItem = {
        name: SORT_BY_FIELD,
        type: ItemType.Select,
        label: 'Sort By',
        values: this._config.sortValues
      } as IFilterConfigSelectItem;


      if (this._config.sort && this._config.sort.value) {
        sortByItem.default = this._config.sort.value;
      }

      this.sortByItem = new SimpleSelectItem(
        sortByItem,
        null,
      );
      this.sortByItem.initValues(p[this.sortByItem.name]);

      const sortDirectionItem = {
        name: SORT_DIRECTION_FIELD,
        type: ItemType.Select,
        label: 'Sort Direction',
        values: [
          { name: 'Ascending', value: 'asc' },
          { name: 'Descending', value: 'desc' }
        ]
      } as IFilterConfigSelectItem;

      if (this._config.sort && this._config.sort.direction) {
        sortDirectionItem.default = this._config.sort.direction;
      }

      this.sortDirectionItem = new SimpleSelectItem(
        sortDirectionItem,
        null
      );
      this.sortDirectionItem.initValues(p[this.sortDirectionItem.name]);
    }
  }
}
