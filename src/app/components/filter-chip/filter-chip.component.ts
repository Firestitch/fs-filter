import {
  ChangeDetectionStrategy, ChangeDetectorRef,
  Component,
  EventEmitter,
  Input, OnDestroy,
  OnInit,
  Output
} from '@angular/core';
import { FsFilterConfigItem } from '../../models/filter-item';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';


@Component({
  selector: 'fs-filter-chip',
  templateUrl: './filter-chip.component.html',
  styleUrls: ['./filter-chip.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FsFilterChipComponent implements OnInit, OnDestroy {
  @Input() public item: FsFilterConfigItem;

  @Output() public remove = new EventEmitter<{ item: FsFilterConfigItem, type: string }>();

  private _destroy$ = new Subject();

  constructor(private _cdRef: ChangeDetectorRef) {
  }

  public ngOnInit() {
    if (this.item.hasPendingValues) {
      this.item.values$
        .pipe(
          takeUntil(this._destroy$),
        )
        .subscribe(() => {
        this._cdRef.markForCheck();
      })
    }
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  public removeItem(item, type = null) {
    this.remove.next({ item: item, type: type });
  }
}
