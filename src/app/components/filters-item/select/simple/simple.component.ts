import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'filter-item-select-simple',
  templateUrl: './simple.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectSimpleComponent {

  @Input() public item;
  @Output() public change = new EventEmitter();

  public changed($event) {
    this.change.emit($event);
  }
}
