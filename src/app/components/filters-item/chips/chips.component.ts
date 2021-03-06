import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  KeyValueDiffers
} from '@angular/core';

import { BaseItemComponent } from '../base-item/base-item.component';
import { ChipsItem } from '../../../models/items/chips-item';


@Component({
  selector: 'filter-item-chips',
  templateUrl: './chips.component.html',
  styleUrls: [ './chips.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChipsComponent extends BaseItemComponent<ChipsItem> {

  constructor(
    protected _kvDiffers: KeyValueDiffers,
    protected _cd: ChangeDetectorRef
  ) {
    super(_kvDiffers, _cd);
  }

  public modelChange() {
    this.itemChange();
  }

  public compareFn(modelValue, chipValue) {
    return modelValue.value === chipValue.value;
  }
}
