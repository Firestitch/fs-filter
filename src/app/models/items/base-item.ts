import { isFunction } from 'lodash-es';

import { BehaviorSubject, isObservable, Observable, Subject } from 'rxjs';
import {
  take,
  takeUntil,
} from 'rxjs/operators';

import { ItemType } from '../../enums/item-type.enum';

import { IFilterConfigBaseItem } from '../../interfaces/items/base.interface';
import { IFilterItemDefaultRange } from '../../interfaces/items/range.interface';


export abstract class BaseItem<T extends IFilterConfigBaseItem> {

  // Configurable properties

  public name: string;
  public label: string | string[];
  public chipLabel: string | string[];
  public hide: boolean;
  public defaultValue: any | IFilterItemDefaultRange;
  public persistedValue: unknown;

  // Internal properties

  public change: (item: IFilterConfigBaseItem) => void;

  protected readonly _type: ItemType;

  protected _model: any;
  protected _initialized = false;
  protected _initialLoading = false;
  protected _pendingValues = false;
  protected _observableValues: Observable<any>;
  protected _value$ = new BehaviorSubject(null);
  protected _valueChange$ = new Subject<void>();
  protected _values$ = new BehaviorSubject(null);

  protected _destroy$ = new Subject<void>();

  constructor(
    itemConfig: T,
    protected _additionalConfig: unknown
  ) {
    this._type = itemConfig.type;
    this._parseConfig(itemConfig);
  }

  public abstract get value();

  ///
  public get isTypeAutocomplete() {
    return this.type === ItemType.AutoComplete;
  }

  public get isTypeAutocompleteChips() {
    return this.type === ItemType.AutoCompleteChips;
  }

  public get isTypeChips() {
    return this.type === ItemType.Chips;
  }

  public get isTypeCheckbox() {
    return this.type === ItemType.Checkbox;
  }

  public get isTypeSelect() {
    return this.type === ItemType.Select;
  }

  public get isTypeDate() {
    return this.type === ItemType.Date;
  }

  public get isTypeDateRange() {
    return this.type === ItemType.DateRange;
  }

  public get isTypeRange() {
    return this.type === ItemType.Range;
  }

  public get isTypeDateTimeRange() {
    return this.type === ItemType.DateTimeRange;
  }

  public get isTypeDateTime() {
    return this.type === ItemType.DateTime;
  }

  public get isTypeKeyword() {
    return this.type === ItemType.Keyword;
  }
  ////

  public get destroy$() {
    return this._destroy$.asObservable();
  }

  public get type(): ItemType {
    return this._type;
  }

  public get hasPendingValues(): boolean {
    return this._pendingValues;
  }

  public get model() {
    return this._model;
  }

  public set model(value) {
    this._setModel(value);
    this.valueChanged();
  }

  public set values(values) {
    this._values$.next(values);
  }

  public get values() {
    return this._values$.getValue();
  }

  public get values$() {
    return  this._values$.asObservable();
  }

  public get valueChange$() {
    return this._valueChange$.asObservable();
  }

  public get value$() {
    return this._value$.asObservable();
  }

  public get initialized() {
    return this._initialized;
  }

  public get initialLoading(): boolean {
    return this._initialLoading;
  }

  public set initialLoading(value: boolean) {
    this._initialLoading = value;
  }

  public valueChanged() {
    this._value$.next(this.value);

    if (this.initialized) {
      if (this.change) {
        this.change(this);
      }

      this._valueChange$.next();
    }
  }

  public get valueAsQuery() {
    const value = this.value;
    const name = this.name;
    const params = [];

    if (Array.isArray(value)) {
      params[name] = value.join(',');
    } else {
      params[name] = value;
    }

    return params;
  }

  public initValues(persistedValue: unknown) {
    this.persistedValue = persistedValue;
    this._initDefaultModel();

    const isAutocomplete = this.type === ItemType.AutoComplete || this.type === ItemType.AutoCompleteChips;

    if (isFunction(this.values) && !isAutocomplete) {
      const valuesResult = this.values();

      if (isObservable(valuesResult)) {
        this._pendingValues = true;
        this._observableValues = valuesResult;
      } else {
        this.values = valuesResult;

        // Move to some other place
        this._init();
        this._initialized = true;
      }

    } else {
      this._init();
      this._initialized = true;
    }
  }

  public loadAsyncValues(reload = true) {
    if (reload || (!this.initialLoading && this.hasPendingValues)) {
      this.initialLoading = true;

      this._observableValues
        .pipe(
          take(1),
          takeUntil(this._destroy$)
        )
        .subscribe((values) => {
          this.values = values;
          this._pendingValues = false;
          this.initialLoading = false;
          this._init();
          this._validateModel();
          this._initialized = true;
        });

    }
  }


  public clear() {
    if (this.isTypeRange || this.isTypeDateRange || this.isTypeDateTimeRange) {
      console.warn(`
        Filter ${this.name} can not be cleared with .clear() method!
        Use special .clearRange() or clearDateRange() instead.
      `)
    }
    this._clearValue();
  };

  public getChipsContent(type): string {
    return '';
  }


  public destroy() {
    this._destroy$.next();
    this._destroy$.complete();
  }

  protected abstract _init();
  protected abstract _validateModel();

  protected _setModel(value) {
    this._model = value;
  }

  protected _parseConfig(item: T) {
    this.name = item.name;
    this.label = item.label;
    this.chipLabel = item.chipLabel;
    this.defaultValue = item.default;
    this.change = item.change;
    this.hide = item.hide;

    this.values = item.values;
  };

  protected _initDefaultModel() {
    const model = this.persistedValue ?? this.defaultValue;

    if (model !== undefined) {
      this.model = model;
    }
  }

  protected _clearValue() {
    this.model = null;
  }
}
