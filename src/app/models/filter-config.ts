import { isEmpty, list as arrayList } from '@firestitch/common';
import { simpleFormat } from '@firestitch/date';
import { Alias, Model } from 'tsmodels';

import { Observable, Subject } from 'rxjs';

import { format, isDate, isValid } from 'date-fns';
import { clone, isObject } from 'lodash-es';

import { FsFilterConfigItem, ItemType } from './filter-item';
import { ChangeFn, FilterSort, Sort } from '../interfaces/config.interface';

export const SORT_BY_FIELD = 'system_sort_by';
export const SORT_DIRECTION_FIELD = 'system_sort_direction';

export class FsFilterConfig extends Model {

  @Alias() public load = true;
  @Alias() public persist: any = false;
  @Alias() public inline = false;
  @Alias() public autofocus = false;
  @Alias() public chips = false;
  @Alias('sorts') public sortValues: any[] = null;
  @Alias() public sort: Sort = null;
  @Alias() public sortDirection = null;
  @Alias() public queryParam = false;
  @Alias() public namespace = 'filter';
  @Alias() public init: ChangeFn;
  @Alias() public change: ChangeFn;
  @Alias() public reload: ChangeFn;
  @Alias() public sortChange: ChangeFn;
  @Alias() public reloadWhenConfigChanged: boolean;

  public items: FsFilterConfigItem[] = [];
  public sortByItem: FsFilterConfigItem = null;
  public sortDirectionItem: FsFilterConfigItem = null;
  public keywordFilter = false;
  public nonKeywordFilters = false;

  private _filtersNames = [];
  private _destroy$ = new Subject<void>();

  constructor(data: any = {}) {
    super();

    this._fromJSON(data);
  }

  get destroy$(): Observable<void> {
    return this._destroy$.asObservable();
  }

  public initItems(items, route, persists) {

    if (items && Array.isArray(items)) {

      this.items = items.map((item, index) => {

        if (index === 0 && item.type === ItemType.Text) {
          item.type = ItemType.Keyword;
        }

        if (item && item.name && this._filtersNames.indexOf(item.name) === -1) {
          this._filtersNames.push(item.name);

          return new FsFilterConfigItem(item, this, route, persists)
        } else {
          throw Error('Filter init error. Items name must be unique.')
        }
      });

      // After all the items have been created and added to this.items initalize the values
      // This is important if some item default values are dependent on others
      this.items.map((item) => {
        item.initValues();
        return item;
      });
    }

    this.initSorting(route, persists);

    this.keywordFilter = !!this.items.find(e => ItemType.Keyword === e.type);
    this.nonKeywordFilters = !!this.items.find(e => ItemType.Keyword !== e.type);
  }

  public getItem(name) {
    return this.items.find((item) => item.name === name);
  }

  public initSorting(route, persists) {
    if (this.sortValues) {
      const sortByItem = {
        name: SORT_BY_FIELD,
        type: ItemType.Select,
        label: 'Sort By',
        values: this.sortValues
      };


      if (this.sort && this.sort.value) {
        sortByItem['default'] = this.sort.value;
      }

      this.sortByItem = new FsFilterConfigItem(sortByItem, this, route, persists);

      const sortDirectionItem = {
        name: SORT_DIRECTION_FIELD,
        type: ItemType.Select,
        label: 'Sort Direction',
        values: [
          { name: 'Ascending', value: 'asc' },
          { name: 'Descending', value: 'desc' }
        ]
      };

      if (this.sort && this.sort.direction) {
        sortDirectionItem['default'] = this.sort.direction;
      }

      this.sortDirectionItem = new FsFilterConfigItem(sortDirectionItem, this, route, persists);
    }
  }

  public updateModelValues() {
    this.items.forEach((filter) => {
      filter.model = clone(filter.model);
    });

    if (this.sortByItem) {
      this.sortByItem.model = clone(this.sortByItem.model);
    }

    if (this.sortDirectionItem) {
      this.sortDirectionItem.model = clone(this.sortDirectionItem.model);
    }
  }

  public gets(opts: any = {}) {

    const query = {};

    for (const filter of this.items) {
      let value = clone(filter.model);

      if (filter.type == ItemType.Select) {

        if (filter.multiple) {

          if (filter.isolate) {
            if (!Array.isArray(filter.model) || !filter.model.length) {
              value = arrayList(filter.values, 'value');
            }
          }

          if (filter.model && filter.model.indexOf('__all') > -1) {
            value = null;
          }

        } else {

          if (filter.isolate) {
            if (filter.model == '__all') {
              value = arrayList(filter.values, 'value');
            }
          } else {
            if (filter.model == '__all') {
              value = null;
            }
          }
        }
      } else if (filter.type == ItemType.AutoCompleteChips || filter.type === ItemType.Chips) {
        if (Array.isArray(filter.model) && filter.model.length && !opts.expand) {
          value = arrayList(filter.model, 'value');
        }
      } else if (filter.type == ItemType.Checkbox) {
        value = filter.model ? filter.checked : filter.unchecked;
      }

      // @TODO
      if (isEmpty(value, { zero: true })) {
        continue;
      }

      if (filter.type == ItemType.Date || filter.type == ItemType.DateTime) {

        if (value && isValid(value) && isDate(value)) {
          value = simpleFormat(value);
        }

      } else if (filter.type == ItemType.DateRange || filter.type == ItemType.DateTimeRange) {

        const from = value.from;
        const to = value.to;

        value = {};
        if (from) {
          value.from = format(from, 'yyyy-MM-dd\THH:mm:ssxxxxx');
        }

        if (to) {
          value.to = format(to, 'yyyy-MM-dd\THH:mm:ssxxxxx');
        }

      } else if (filter.type == ItemType.AutoComplete) {

        if (isEmpty(filter.model.value, {zero: true})) {
          continue;
        }

        value = opts.expand ? filter.model : filter.model.value;
      }

      if (isObject(filter.names) && opts.names !== false) {
        for (const key in filter.names) {
          if (value[filter.names[key]]) {
            query[key] = value[filter.names[key]];
          }
        }
      } else {
        query[filter.name] = value;
      }
    }

    if (opts.flatten) {
      for (const name in query) {
        if (Array.isArray(query[name])) {
          query[name] = query[name].join(',');
        }
      }
    }

    return query;
  }

  public getSort(): FilterSort | null {
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

  public getFilledItems() {
    return this.items.reduce((acc, filter) => {

      switch (filter.type) {
        case ItemType.Select: {
          const multipleIsoldated = filter.multiple
            && filter.isolate
            && Array.isArray(filter.model)
            && filter.model.length
            && filter.model.indexOf('__all') === -1;

          const multipleHasSelectedValues = filter.multiple
            && Array.isArray(filter.model)
            && filter.model.length
            && filter.model.indexOf('__all') === -1;

          const selectedValues = !filter.multiple && filter.model && filter.model !== '__all';

          if (multipleIsoldated || multipleHasSelectedValues || selectedValues) {
            acc.push(filter);
          }
        } break;

        case ItemType.AutoCompleteChips: {
          if (Array.isArray(filter.model) && filter.model.length) {
            acc.push(filter);
          }
        } break;

        case ItemType.Checkbox: {
          if (filter.model) {
            acc.push(filter);
          }
        } break;

        case ItemType.DateRange: case ItemType.DateTimeRange: {
          if (filter.model.from || filter.model.to) {
            acc.push(filter);
          }
        } break;

        case ItemType.Keyword: {} break;

        default: {
          if (filter.model &&
            (!isEmpty(filter.model, { zero: true }) || !isEmpty(filter.model.value, {zero: true}))
          ) {
            acc.push(filter);
          }
        }

      }

      return acc;
    }, []);
  }

  public filtersClear() {
    for (const filter of this.items) {
      filter.clear();
    }

    if (this.sortByItem) {
      if (this.sort) {
        this.sortByItem.model = this.sort.value
      } else {
        this.sortByItem.clear();
      }
    }

    if (this.sortDirectionItem) {
      if (this.sort) {
        this.sortDirectionItem.model = this.sort.direction
      } else {
        this.sortDirectionItem.clear();
      }
    }
  }

  public loadValuesForPendingItems() {
    this.items
      .filter((item) => item.hasPendingValues)
      .forEach((item) => item.loadValues(false));
  }

  public destroy() {
    this._destroy$.next();
    this._destroy$.complete();
  }
}
