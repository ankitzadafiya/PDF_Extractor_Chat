import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewPdf } from './view-pdf';

describe('ViewPdf', () => {
  let component: ViewPdf;
  let fixture: ComponentFixture<ViewPdf>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewPdf]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewPdf);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
