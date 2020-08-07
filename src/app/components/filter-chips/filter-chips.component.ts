import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { BaseItem } from '../../models/items/base-item';


@Component({
  selector: 'fs-filter-chips',
  templateUrl: './filter-chips.component.html',
  styleUrls: ['./filter-chips.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FsFilterChipsComponent {
  @Input() public filters: BaseItem<any>[];
  @Output() public remove = new EventEmitter<{ item: BaseItem<any>, type: string }>();

  public chips = [];

  public removeItem(event) {
    this.remove.next(event);
  }
}
