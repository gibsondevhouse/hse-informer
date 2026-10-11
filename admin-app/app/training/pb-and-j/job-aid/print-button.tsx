'use client';

import { Printer } from 'lucide-react';

export function PrintButton() {
  return <button className="pbj-aid-print" type="button" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />Print guide</button>;
}
