import type { Metadata } from 'next';
import Link from 'next/link';
import { PrintButton } from './print-button';
import './job-aid.css';

export const metadata: Metadata = {
  title: 'PBJ-101 · Standard method job aid | HSE Informer',
  description: 'Printable seven-step practice guide for the PBJ-101 sample course.',
};

const steps = [
  ['01', 'Gather and inspect', 'Wash hands, prepare the station, and check ingredient labels and dates. Stop if an ingredient is unsuitable for the recipient.'],
  ['02', 'Lay out the bread', 'Place two matching slices side by side on a clean board.'],
  ['03', 'Spread the peanut butter', 'Use its dedicated spreader. Work from the center to the edges with light pressure.'],
  ['04', 'Spread the fruit spread', 'Use a separate spreader on the second slice. Cover it evenly to the edges.'],
  ['05', 'Close', 'Set the fruit-spread slice onto the peanut butter slice, spread sides together, and press lightly.'],
  ['06', 'Cut if requested', 'Make one straight or diagonal cut, moving the blade away from your hand.'],
  ['07', 'Plate or wrap and reset', 'Serve or wrap the sandwich, close the jars, clean the tools, and reset the station.'],
] as const;

export default function JobAidPage() {
  return <main className="pbj-aid">
    <header className="pbj-aid-header">
      <div><span className="pbj-aid-brand">HSE Informer <span>· PBJ-101</span></span><span className="pbj-aid-label">Practice job aid</span></div>
      <div className="pbj-aid-actions"><PrintButton /><Link href="/training/pb-and-j">Back to course</Link></div>
    </header>
    <div className="pbj-aid-title"><div><p className="pbj-aid-kicker">Keep at your station</p><h1>The seven-step standard method</h1><p>A quick reference for preparing a consistent peanut butter and jelly sandwich.</p></div><span aria-hidden="true">PB&J</span></div>
    <section aria-labelledby="method-heading"><h2 id="method-heading">Prepare · Assemble · Finish</h2><ol className="pbj-aid-steps">{steps.map(([number, title, detail]) => <li key={number}><span>{number}</span><div><strong>{title}</strong><p>{detail}</p></div></li>)}</ol></section>
    <div className="pbj-aid-panels"><section><h2>Before you serve</h2><ul><li>Confirm the recipient’s ingredient needs and read the product labels.</li><li>Check for even edge-to-edge coverage, a tidy exterior, and a clean cut.</li><li>Keep a separate utensil with each jar to avoid cross-contact.</li></ul></section><section><h2>After you finish</h2><ul><li>Close and store jars.</li><li>Wash and dry utensils.</li><li>Clear crumbs, clean and sanitize the work surface, and wash hands.</li></ul></section></div>
    <footer><span>PBJ-101 · Practice reference · Version 1.0</span><span>Browser-only sample. This is not a workplace training record or qualification.</span></footer>
  </main>;
}
