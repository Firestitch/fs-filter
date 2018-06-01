import { isEmpty } from '@firestitch/common/util';
import { list as arrayList } from '@firestitch/common/array';
import { Alias, Model } from 'tsmodels';

import * as moment from 'moment';
import * as _isObject from 'lodash/isObject';
import * as _clone from 'lodash/clone';

import { FsFilterConfigItem } from './fs-filter-item';


export class FsFilterConfig extends Model {

  @Alias() public load = true;
  @Alias() public persist: any = false;
  @Alias() public inline = false;
  @Alias() public namespace = 'filter';
  @Alias() public init: Function;
  @Alias() public change: Function;

  public items: FsFilterConfigItem[] = [];

  constructor(data: any = {}) {
    super();

    this._fromJSON(data);
  }

  public initItems(items, route, persists) {
    if (items && Array.isArray(items)) {
      this.items = items.map((item) => new FsFilterConfigItem(item, this, route, persists));
    }
  }

  public gets(opts: any = {}) {

    const query = {};

    for (const filter of this.items) {

      let value = _clone(filter.model);

      if (filter.type == 'select') {

        if (filter.multiple) {

          if (filter.isolate) {
            if (!Array.isArray(filter.model) || !filter.model.length) {
              value = arrayList(filter.values, 'value');
            }
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
      } else if (filter.type == 'autocompletechips') {
        if (Array.isArray(filter.model) && filter.model.length && !opts.expand) {
          value = arrayList(filter.model, 'value');
        }
      } else if (filter.type == 'checkbox') {
        value = filter.model ? filter.checked : filter.unchecked;
      }

      // @TODO
      if (isEmpty(value, { zero: true })) {
        continue;
      }

      if (filter.type == 'date' || filter.type == 'datetime') {

        if (value) {
          value = moment(value).format();
        }

      } else if (filter.type == 'daterange' || filter.type == 'datetimerange') {

        const from = value.from;
        const to = value.to;

        value = {};
        if (from) {
          value.from = moment(from).format();
        }

        if (to) {
          value.to = moment(to).format();
        }

      } else if (filter.type == 'autocomplete') {

        if (isEmpty(filter.model.value, {zero: true})) {
          continue;
        }

        value = opts.expand ? filter.model : filter.model.value;
      }

      if (_isObject(filter.names) && opts.names !== false) {
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

  public filtersClear() {
    for (const filter of this.items) {
      filter.model = undefined;
      if (filter.type == 'autocomplete') {
        filter.model = null;
        filter.search = '';
      } else if (filter.type == 'autocompletechips') {
        filter.model = [];
        filter.search = '';
      } else if (filter.type == 'select' && filter.isolate) {
        filter.model = null;
        filter.isolate.enabled = false;
      } else if (filter.type == 'checkbox') {
        filter.model = false;
      } else if (filter.type == 'range') {
        filter.model = {};
      }
    }
  }
}