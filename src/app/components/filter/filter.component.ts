import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Injector,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation,
  Output,
  Optional,
  Inject,
  ContentChild,
  TemplateRef,
  HostBinding,
} from '@angular/core';
import { NgModel } from '@angular/forms';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatInput } from '@angular/material/input';

import { FsStore } from '@firestitch/store';

import { fromEvent, Observable, Subject } from 'rxjs';
import { debounceTime, filter, map, takeUntil } from 'rxjs/operators';

import { FS_FILTER_CONFIG } from './../../injectors/filter-config';
import { FsFilterConfig } from '../../models/filter-config';
import { FsFilterConfigItem } from '../../models/filter-item';
import { objectsAreEquals } from '../../helpers/compare';
import { FilterParams } from '../../models/filter-params';
import { FsFilterOverlayService } from '../../services/filter-overlay.service';
import { ItemType } from '../../enums/item-type.enum';
import { MatDialogRef } from '@angular/material/dialog';
import { FilterStatusBarDirective } from './../../directives/status-bar/status-bar.directive';
import { PersistanceStore } from '../../classes/persistance-store';
import { FilterConfig } from '../../interfaces/config.interface';
import { getNormalizedPath } from '../../helpers/get-normalized-path';


@Component({
  selector: 'fs-filter',
  styleUrls: [ './filter.component.scss' ],
  templateUrl: './filter.component.html',
  encapsulation: ViewEncapsulation.None,
  providers: [
    FsFilterOverlayService,
    PersistanceStore,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilterComponent implements OnInit, AfterViewInit, OnDestroy {

  @HostBinding('class.filters-open') showFilterMenu = false;
  @HostBinding('class.window-desktop') windowDesktop = false;
  @HostBinding('class.fs-filter') fsFilterClass = true;

  @Input('config') set setConfig(config) {
    this._initFilterWithConfig(config);
  }

  @Input('filter') set setFilter(config) {
    this._initFilterWithConfig(config);
  }

  @Input() public sortUpdate: EventEmitter<any> = null;
  @Input() public showSortBy: any = true;
  @Input() public showFilterInput = true;
  @Output() public closed = new EventEmitter<any>();
  @Output() public opened = new EventEmitter<any>();

  @ContentChild(FilterStatusBarDirective, { static: false, read: TemplateRef })
  public statusBar;

  @ViewChild('searchTextInput', { static: false }) public searchTextInput: ElementRef;
  @ViewChild('searchTextInput', { static: false, read: MatInput }) public searchTextMatInput: MatInput;

  @ViewChild('searchTextInput', { read: NgModel, static: false })
  set searchTextNgModel(value) {
    this._searchTextNgModel = value;
  }

  public changedFilters = [];
  public searchText = '';
  public searchPlaceholder = 'Search';
  public activeFiltersCount = 0;
  public activeFiltersWithInputCount = 0;

  protected _config: FsFilterConfig = null;

  private _filterChanged$ = new Subject<FsFilterConfigItem>();
  private _searchTextItem: FsFilterConfigItem;
  private _searchTextNgModel: NgModel = null;
  private _firstOpen = true;
  private _filterParams: FilterParams;
  private _sort = {};
  private _destroy$ = new Subject();

  constructor(
    private _store: FsStore,
    private _location: Location,
    private _route: ActivatedRoute,
    private _router: Router,
    private _injector: Injector,
    private _filterOverlay: FsFilterOverlayService,
    private _zone: NgZone,
    private _cdRef: ChangeDetectorRef,
    private _persistanceStore: PersistanceStore,
    @Optional() private _dialogRef: MatDialogRef<any>,
    @Optional() @Inject(FS_FILTER_CONFIG) private _defaultConfig: FsFilterConfig
  ) {
    this._updateWindowWidth();

    this._filterOverlay.attach$
    .pipe(
     takeUntil(this._destroy$)
    )
    .subscribe(() => {
      this.showFilterMenu = true;
    });

    this._filterOverlay.detach$
    .pipe(
      takeUntil(this._destroy$)
    )
    .subscribe(() => {
      this.updateFilledCounter();
      this.showFilterMenu = false;
    });

    this._listenWindowResize();
  }

  public get config(): FsFilterConfig {
    return this._config;
  }

  public get filterParams(): FilterParams {
    return this._filterParams;
  }

  public ngOnInit() {

    // Avoid ngChanges error
    setTimeout(() => {
      if (this.config.autofocus) {
        this.focus();
      }
    });

    if (this.sortUpdate) {
      this.sortUpdate
        .pipe(
          takeUntil(this.config.destroy$),
        )
        .subscribe((data) => {
          this.config.updateSort(data);
        });
    }

    if (this.config.init) {
      this.init();
    }
  }

  public ngAfterViewInit(): void {
    this._listenInputKeyEvents();
    this._listenInputChanges();
    this._listenFilterChanges();
  }

  public focus() {
    if (this.searchTextMatInput) {
      this.searchTextMatInput.focus();
    }
  }

  public ngOnDestroy() {

    this._destroyFilterDrawer();

    this._destroy$.next();
    this._destroy$.complete();

    if (this.config) {
      this.config.destroy();
    }
  }

  /**
   *
   * Do update value of some field
   *
   * @param values - values for update
   * @param changeEvent - should change event to be fired
   *
   * To update text value just pass new text value
   *
   * public updateSelectValue(val) {
   *   this.filterEl.updateValues({ keyword: val });
   * }
   *
   * To update select or observable select you could pass suitable value
   *
   * public updateSelectValue(val: number) {
   *   this.filterEl.updateValues({ simple_select: val }, { observable_select: val });
   * }
   *
   * To update checkbox value just pass true/false as value
   *
   * public updateCheckox(val: boolean) {
   *   this.filterEl.updateValues({ checkbox: val });
   * }
   *
   * To update range value just pass object with min&max object or just with one of targets
   *
   * Ex.: { min: 10, max 15 }, { min: 5 }, { max 5 }
   *
   * public updateRange(val) {
   *   this.filterEl.updateValues({ range: val });
   * }
   *
   * To update autocomplete just pass object with name/value fields
   *
   * Ex.: { name: 'John Doe', value: 1 }
   *
   * public updateAutocomplete(val) {
   *   this.filterEl.updateValues({ autocomplete_user_id: val });
   * }
   *
   * To update autocompletechips just pass:
   *
   * 1) object with name/value fields - will be appended to existing set of values
   *
   * { name: 'John Doe', value: 1 }
   *
   * 2) array of objects - will be appended to existing set of values
   *
   * [{ name: 'John Doe', value: 1 }, { name: 'Darya Filipova', value: 2 }]
   *
   * 3) null - clear existing set of values
   *
   * public updateAutocomplete(val) {
   *   this.filterEl.updateValues({ autocompletechips_user_id: val });
   * }
   *
   */
  public updateValues(values, changeEvent = true) {
    Object.keys(values).forEach((key) => {
      const filterItem = this.config.items.find((item) => item.name === key);

      if (!filterItem) {
        return;
      }

      filterItem.updateValue(values[key]);
    });

    this.updateFilledCounter();

    if (changeEvent) {
      this._filterChanged$.next();
      // this._filterChange();
    }
  }

  public hide() {
    this.changeVisibility(false);
  }

  public show() {
    this.changeVisibility(true);
  }

  public changeVisibilityClick(value, event = null) {

    if (event) {
      event.stopPropagation();
    }

    this.changeVisibility(value);
  }

  public filterInputEvent(event: KeyboardEvent) {

    if (!this.windowDesktop) {
      return;
    }
    if (['Enter', 'NumpadEnter', 'Escape'].indexOf(event.code) >= 0) {
      this.changeVisibility(false);

      if (this.searchTextInput) {
        this.searchTextInput.nativeElement.blur()
      }
    }
  }

  public getItemValue(name: string) {
    const item = this.config.items.find((item) => item.name === name);

    if (item) {
      return item.model;
    } else {
      return null;
    }
  }

  public getItemValueChange$(name: string): Observable<any> | null {
    const item = this.config.items.find((i) => i.name === name);

    if (item) {
      return item.valueChanged$
        .pipe(
          filter((value) => !!value),
          map(() => {
            return this.getItemValue(name);
          }),
        );
    } else {
      return null;
    }
  }

  public changeVisibility(state: boolean) {

    if (state === this.showFilterMenu) {
      return;
    }

    if (!state) {
      this.closed.emit();
      return this._destroyFilterDrawer();
    }

    const notTextItem = this.config.items.find((item) => {
      return item.type !== ItemType.Keyword;
    });

    if (!notTextItem) {
      return;
    }

    this._listenEscButton();

    this.opened.next();

    this._filterOverlay.open(this._injector,  {
      items: this.config.visibleItems,
      showSortBy: 'showSortBy',
      sortItem: this.config.sortByItem,
      sortDirectionItem: this.config.sortDirectionItem,
      filterChanged: this._filterChanged$,
      search: this.search.bind(this),
      done: this.hide.bind(this),
      clear: this.clear.bind(this)
    });

    if (this._firstOpen) {
      this.config.loadValuesForPendingItems();
      this._firstOpen = false;
    }
  }

  public clearSearchText(event) {
    event.stopPropagation();
    this.searchText = '';
    this.searchTextInput.nativeElement.focus();
  }

  public init() {

    const data = this._filterParams.getFlattenedParams();
    this._sort = this.config.getSort();

    this.config.init(data, this.config.getSort());
  }

  public clear(event = null) {

    if (event) {
      event.stopPropagation();
    }

    this.searchText = '';
    this.changedFilters = [];
    this.config.filtersClear();
    this.activeFiltersCount = 0;
    this.activeFiltersWithInputCount = 0;
    this._filterChanged$.next();
    // this._filterChange();
    this.changeVisibility(false);

    if (this.config.clear) {
      this.config.clear();
    }
  }

  /**
   * Close filter window and do change callback
   */
  public search(event) {
    this.changeVisibilityClick(false, event);
    this._filterChanged$.next();
    // this._filterChange();
  }

  public reload(event = null) {

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const data = this._filterParams.getFlattenedParams();

    if (this.config.reload) {
      this.config.reload(data, this.config.getSort());
    }
  }

  /**
   * Reset filter
   * @param event
   */
  public resetFilter(event: { item: FsFilterConfigItem, type: string }) {
    const item = event.item;
    const type = event.type;

    const index = this.changedFilters.indexOf(item);

    if (index > -1) {
      if (type) {
        item.partialClear(type);

        if (!item.valueChanged) {
          this.changedFilters.splice(index, 1);
        }
      } else {
        this.changedFilters.splice(index, 1);
        item.clear();
      }
    }

    if (item.change) {
      item.change(item);
    }
    this.change();
  }

  /**
   * Call change callback and apply new filter values
   */
  public change() {

    this.config.updateModelValues();
    const data = this._filterParams.getFlattenedParams();
    const sort = this.config.getSort();

    const sortingChanged = ((!sort || !this._sort) && sort !== this._sort)
      || (sort && this._sort && !objectsAreEquals(this._sort, sort));

    if (sortingChanged) {
      this._sort = sort;

      if (this.config.sortChange) {
        this.config.sortChange(data, sort);
      }
    }

    // This should be an option or a done with an wrapping helper function
    // because it restricts functionality ie. reload
    // const queryChanged = !objectsAreEquals(this._query, query);
    // if (queryChanged) {

    this.updateFilledCounter();

    if (this.config.change) {
      this.config.change(data, sort);
    }

    if (this.config.queryParam) {
      this._filterParams.updateQueryParams();
    }

    this._persistanceStore.save(this._filterParams.queryParams);
  }

  /**
   * Do update count of filled filters
   */
  private updateFilledCounter() {
    this.changedFilters = this.config.getFilledItems();

    this.changedFilters
      .filter((item) => item.hasPendingValues)
      .forEach((item) => item.loadValues(false));

    this.activeFiltersWithInputCount =  this.changedFilters
                                          .filter((item) => item.type !== ItemType.Keyword)
                                          .length;

    this._cdRef.markForCheck();
  }

  private _initFilterWithConfig(config: FilterConfig) {
    if (this.config) {
      this.config.destroy();
    }

    config = {
      ...(this._defaultConfig || {}),
      ...config,
    };

    this._config = new FsFilterConfig(config);

    this._listenInternalItemsChange();
    if (this._config.persist) {
      if (typeof this._config.persist === 'object') {
        if (this._config.persist.name) {
          this._config.namespace = this._config.persist.name;
        }
      }
    }

    if (!this._config.case) {
      this._config.case = 'snake';
    }

    const namespace = this.config.namespace || getNormalizedPath(this._location);
    this._persistanceStore.configUpdated(this._config.persist, namespace, !!this._dialogRef);
    this._persistanceStore.restore()

    this.config.initItems(config.items, this._route, this._persistanceStore);

    this._filterParams = new FilterParams(this._router, this._route, this.config);
    if (this.config.queryParam) {
      // Read from query params
      this._filterParams.updateFromQueryParams(this._route.snapshot.queryParams);

      // To fill query params with default values
      this._filterParams.updateQueryParams();
    }

    this._searchTextItem = this.config.items.find((item) => item.isTypeKeyword);
    if (this._searchTextItem) {
      this.searchText = this._searchTextItem.model;
      this.searchPlaceholder = this._searchTextItem.label || 'Search';
    }

    // Count active filters after restore
    this.updateFilledCounter();

    this._persistanceStore.save(this._filterParams.queryParams);

    if (!!this.config.reloadWhenConfigChanged) {
      this.change();
    }
  }

  /**
   * Store updated filter data into localstorage
   * @param changedItem
   */
  private _listenFilterChanges() {
    this._filterChanged$.pipe(
      debounceTime(200),
      takeUntil(this._destroy$),
    )
      .subscribe((changedItem: FsFilterConfigItem) => {
        if (changedItem) {
          changedItem.checkIfValueChanged();
        }

        this.change();
      })
  }

  private _destroyFilterDrawer() {
    this._filterOverlay.close();
  }

  private _updateWindowWidth() {
    this.windowDesktop = window.innerWidth > 1200;
  }

  private _listenEscButton() {
    this._zone.runOutsideAngular(() => {
      fromEvent(window, 'keyup')
        .pipe(
          filter((event: KeyboardEvent) => event.code === 'Escape'),
          takeUntil(this.closed),
          takeUntil(this._destroy$),
        )
        .subscribe(() => {
          this._zone.run(() => {
            this.changeVisibility(false);
          });
        });
    });
  }

  private _listenInputKeyEvents() {
    if (!this.searchTextInput) {
      return;
    }

    this._zone.runOutsideAngular(() => {
      fromEvent(this.searchTextInput.nativeElement, 'keydown')
        .pipe(
          debounceTime(500),
          filter((event: KeyboardEvent) => {
            return ['Enter', 'NumpadEnter', 'Escape'].indexOf(event.code) > -1;
          }),
          takeUntil(this._destroy$),
        )
        .subscribe((event: KeyboardEvent) => {
          this._zone.run(() => {
            this.filterInputEvent(event)
          });
        });
    });
  }

  private _listenWindowResize() {
    this._zone.runOutsideAngular(() => {
      fromEvent(window, 'resize')
        .pipe(
          debounceTime(100),
          takeUntil(this._destroy$),
        )
        .subscribe(() => {
          this._zone.run(() => {
            this._updateWindowWidth();
          });
        });
    })
  }

  private _listenInputChanges() {
    if (!this._searchTextNgModel) {
      return;
    }

    this._zone.runOutsideAngular(() => {
      this._searchTextNgModel.valueChanges
        .pipe(
          debounceTime(200),
          filter((value) => value !== void 0),
          takeUntil(this._destroy$),
        )
        .subscribe((value) => {
          this._zone.run(() => {
            if (this._searchTextItem) {
              this._searchTextItem.model = value;
            }

            this._filterChanged$.next();
          });
        });

    });
  }

  private _listenInternalItemsChange() {
    this.config.itemsChanged$
      .pipe(
        takeUntil(this._destroy$),
      )
      .subscribe(() => {
        this.change();
      });
  }
}
