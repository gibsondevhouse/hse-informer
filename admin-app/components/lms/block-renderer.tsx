'use client';

import { Bug } from 'lucide-react';
import type { Block } from '@/lib/lms/schema';
import {
  AttestationView,
  Checklist,
  Reflection,
  Survey,
} from './activity-blocks';
import {
  Callout,
  Definition,
  Divider,
  Figure,
  Glossary,
  Heading,
  KeyTakeaways,
  List,
  Media,
  Objectives,
  Paragraph,
  References,
  Resource,
  Steps,
  Table,
  Timeline,
} from './content-blocks';
import {
  AccordionBlockView,
  Flashcards,
  Hotspots,
  TabsBlockView,
} from './disclosure-blocks';
import type { BlockEnv } from './env';
import { Interaction } from './interaction-blocks';

export function BlockRenderer({
  block,
  env,
}: {
  block: Block;
  env: BlockEnv;
}) {
  return (
    <div className="lms-block" data-block-type={block.type}>
      {env.showDevNotes && (
        <div className="lms-dev-note">
          <Bug size={13} aria-hidden="true" />
          <code>{block.type}</code>
          {block.devNote && <span>{block.devNote}</span>}
        </div>
      )}
      <BlockBody block={block} env={env} />
    </div>
  );
}

function BlockBody({ block, env }: { block: Block; env: BlockEnv }) {
  switch (block.type) {
    case 'heading':
      return <Heading block={block} />;
    case 'paragraph':
      return <Paragraph block={block} />;
    case 'callout':
      return <Callout block={block} />;
    case 'objectives':
      return <Objectives block={block} />;
    case 'list':
      return <List block={block} />;
    case 'keyTakeaways':
      return <KeyTakeaways block={block} />;
    case 'definition':
      return <Definition block={block} />;
    case 'glossary':
      return <Glossary block={block} />;
    case 'figure':
      return <Figure block={block} />;
    case 'media':
      return <Media block={block} />;
    case 'steps':
      return <Steps block={block} />;
    case 'timeline':
      return <Timeline block={block} />;
    case 'table':
      return <Table block={block} />;
    case 'resource':
      return <Resource block={block} />;
    case 'references':
      return <References block={block} />;
    case 'divider':
      return <Divider />;
    case 'accordion':
      return <AccordionBlockView block={block} />;
    case 'tabs':
      return <TabsBlockView block={block} />;
    case 'flashcards':
      return <Flashcards block={block} />;
    case 'hotspots':
      return <Hotspots block={block} />;
    case 'checklist':
      return <Checklist block={block} env={env} />;
    case 'reflection':
      return <Reflection block={block} env={env} />;
    case 'survey':
      return <Survey block={block} env={env} />;
    case 'attestation':
      return <AttestationView block={block} env={env} />;
    case 'multipleChoice':
    case 'multipleResponse':
    case 'trueFalse':
    case 'fillBlank':
    case 'numeric':
    case 'matching':
    case 'sequencing':
    case 'sorting':
    case 'scenario':
      return <Interaction block={block} env={env} />;
  }
}
