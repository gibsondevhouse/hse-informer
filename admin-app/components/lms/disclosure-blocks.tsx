'use client';

import { useId, useState } from 'react';
import { CircleDot, Eye, RotateCcw } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  AccordionBlock,
  FlashcardsBlock,
  HotspotsBlock,
  TabsBlock,
} from '@/lib/lms/schema';
import { Illustration } from './illustrations';

export function AccordionBlockView({ block }: { block: AccordionBlock }) {
  return (
    <section className="lms-accordion" aria-label={block.title ?? 'Expandable sections'}>
      {block.title && <h3>{block.title}</h3>}
      <Accordion multiple>
        {block.items.map((item, index) => (
          <AccordionItem value={index} key={item.title}>
            <AccordionTrigger>{item.title}</AccordionTrigger>
            <AccordionContent>
              <p>{item.text}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

export function TabsBlockView({ block }: { block: TabsBlock }) {
  const [value, setValue] = useState(0);
  return (
    <section className="lms-tabs" aria-label={block.title ?? 'Tabbed content'}>
      {block.title && <h3>{block.title}</h3>}
      <Tabs value={value} onValueChange={(next) => setValue(Number(next))}>
        <TabsList variant="line" aria-label={block.title ?? 'Tabbed content'}>
          {block.tabs.map((tab, index) => (
            <TabsTrigger value={index} key={tab.label}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {block.tabs.map((tab, index) => (
          <TabsContent value={index} key={tab.label} className="lms-tab-panel">
            <p>{tab.text}</p>
            {tab.bullets && (
              <ul>
                {tab.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

export function Flashcards({ block }: { block: FlashcardsBlock }) {
  const [flipped, setFlipped] = useState<number[]>([]);
  const toggle = (index: number) =>
    setFlipped((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index],
    );
  return (
    <section className="lms-flashcards" aria-label={block.title ?? 'Flashcards'}>
      <div className="lms-flashcards-heading">
        <h3>{block.title ?? 'Flashcards'}</h3>
        <span className="lms-muted">
          {flipped.length} of {block.cards.length} revealed
        </span>
        {flipped.length > 0 && (
          <button
            type="button"
            className="lms-text-button"
            onClick={() => setFlipped([])}
          >
            <RotateCcw size={14} aria-hidden="true" />
            Reset cards
          </button>
        )}
      </div>
      <ul className="lms-flashcard-grid">
        {block.cards.map((card, index) => {
          const isFlipped = flipped.includes(index);
          return (
            <li key={card.front}>
              <button
                type="button"
                className={`lms-flashcard ${isFlipped ? 'is-flipped' : ''}`}
                aria-pressed={isFlipped}
                onClick={() => toggle(index)}
              >
                <span className="lms-flashcard-face-label">
                  {isFlipped ? 'Back' : 'Front'}
                </span>
                <span className="lms-flashcard-text">
                  {isFlipped ? card.back : card.front}
                </span>
                <span className="lms-flashcard-hint" aria-hidden="true">
                  {isFlipped ? 'Select to see the term' : 'Select to reveal'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Positioned markers plus an equivalent list so precision pointing is never required. */
export function Hotspots({ block }: { block: HotspotsBlock }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [visited, setVisited] = useState<string[]>([]);
  const panelId = useId();
  const active = block.hotspots.find((spot) => spot.id === selected) ?? null;
  const choose = (id: string) => {
    setSelected((current) => (current === id ? null : id));
    setVisited((current) => (current.includes(id) ? current : [...current, id]));
  };
  return (
    <section className="lms-hotspots" aria-label={block.title ?? 'Explore the image'}>
      <div className="lms-hotspots-heading">
        <h3>{block.title ?? 'Explore the image'}</h3>
        <span className="lms-muted">
          <Eye size={14} aria-hidden="true" /> {visited.length} of{' '}
          {block.hotspots.length} explored
        </span>
      </div>
      <div className="lms-hotspot-stage">
        <Illustration art={block.art} alt={block.alt} className="lms-art" />
        {block.hotspots.map((spot, index) => (
          <button
            type="button"
            key={spot.id}
            className={`lms-hotspot-marker ${selected === spot.id ? 'is-active' : ''} ${visited.includes(spot.id) ? 'is-visited' : ''}`}
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
            aria-label={spot.label}
            aria-expanded={selected === spot.id}
            aria-controls={panelId}
            onClick={() => choose(spot.id)}
          >
            {index + 1}
          </button>
        ))}
      </div>
      <output className="lms-hotspot-panel" id={panelId}>
        {active ? (
          <>
            <strong>{active.label}</strong>
            <p>{active.text}</p>
          </>
        ) : (
          <p className="lms-muted">
            Select a numbered marker on the image, or choose from the list.
          </p>
        )}
      </output>
      <ol className="lms-hotspot-list" aria-label="Points of interest">
        {block.hotspots.map((spot) => (
          <li key={spot.id}>
            <button
              type="button"
              className={selected === spot.id ? 'is-active' : ''}
              aria-expanded={selected === spot.id}
              aria-controls={panelId}
              onClick={() => choose(spot.id)}
            >
              <CircleDot size={14} aria-hidden="true" />
              {spot.label}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
