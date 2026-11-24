import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import './app.css';
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Theme} from '@astryxdesign/core/theme';
import {AppShell, useAppShellMobile} from '@astryxdesign/core/AppShell';
import {MobileNav, MobileNavToggle} from '@astryxdesign/core/MobileNav';
import {SideNav, SideNavItem, SideNavSection, SideNavRenderContext} from '@astryxdesign/core/SideNav';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {Card} from '@astryxdesign/core/Card';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Banner} from '@astryxdesign/core/Banner';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {themes, defaultThemeSlug} from '../astryx-themes.js';
import {ArrowTopRightOnSquareIcon, PlusIcon, HomeIcon, DocumentTextIcon, MagnifyingGlassIcon, UsersIcon, MapPinIcon, EnvelopeIcon, PencilSquareIcon, ListBulletIcon, LinkIcon} from '@heroicons/react/24/outline';
import {PLAN} from './plan.js';

const ic = (I) => <Icon icon={I} size="sm" />;
const fav = (name) => <span className="fav">{name[0]}</span>;

function Section({title, sub, count, children}) {
  return (
    <Card><VStack gap={3}>
      <VStack gap={1}>
        <HStack gap={2} align="center"><Heading level={3}>{title}</Heading>{count != null && <Badge label={String(count)} />}</HStack>
        {sub && <Text type="supporting" color="secondary">{sub}</Text>}
      </VStack>
      {children}
    </VStack></Card>
  );
}

const Cell = ({href, title, text, left}) => (
  <Card variant="subtle" {...(href ? {href, target: '_blank'} : {})}><VStack gap={1}>
    <HStack gap={2} align="center">{left}<Text weight="semibold">{title}</Text></HStack>
    <Text type="supporting" color="secondary">{text}</Text>
  </VStack></Card>
);

function Draft({to, title, body, actions}) {
  return (
    <Card variant="subtle"><VStack gap={2}>
      <Text type="supporting" color="secondary">{to}</Text>
      <Text weight="semibold">{title}</Text>
      <div className="pre">{body}</div>
      <HStack gap={2} wrap="wrap">{actions.map((a, i) => <Button key={a} label={a} size="sm" variant={i === 0 ? 'primary' : 'secondary'} />)}<Button label="Copy" size="sm" variant="ghost" /></HStack>
    </VStack></Card>
  );
}

function Plan() {
  const p = PLAN;
  const [tab, setTab] = useState('all');
  const [ask, setAsk] = useState(false);
  const show = (k) => tab === 'all' || tab === k;
  return (
    <div className="page"><VStack gap={4}>
      <Banner variant="info" title="Mock" description="The live plan /p/9ec40314ba0ev now answers 404 (plans are kept 30 days), so this shows Grow's own example plan with real Astryx components and the Flisk bar." />
      {ask && <Banner variant="info" title="Sign in to save this plan" description="Only saving needs an account. Everything else here works without one." actions={<Button label="Sign in with GitHub" size="sm" variant="primary" />} />}
      <HStack gap={3} align="start" justify="space-between" wrap="wrap">
        <VStack gap={2} style={{flex: 1, minWidth: 260}}>
          <Heading level={1}>A plan for {p.name}</Heading>
          <Text color="secondary">{p.product}</Text>
          <HStack gap={2} wrap="wrap"><Badge label="Kept 30 days" variant="blue" /><Badge label="Nothing is posted for you" /><Badge label={'AI search ' + p.check.score + '/100'} variant="error" /></HStack>
        </VStack>
        <HStack gap={2} wrap="wrap">
          <Button label="Save to my cabinet" variant="primary" onClick={() => setAsk(true)} />
          <Button label="Copy link" variant="secondary" icon={ic(LinkIcon)} />
          <Button label="Open the site" variant="secondary" href={p.url} target="_blank" icon={ic(ArrowTopRightOnSquareIcon)} />
        </HStack>
      </HStack>

      <div><SegmentedControl label="Plan sections" value={tab} onChange={setTab}>
        <SegmentedControlItem value="all" label="Overview" />
        <SegmentedControlItem value="emails" label={'Emails ' + p.emails.length} />
        <SegmentedControlItem value="posts" label={'Posts ' + p.posts.length} />
        <SegmentedControlItem value="list" label={'Listings ' + p.listings.length} />
      </SegmentedControl></div>

      {tab === 'all' && <>
        <Section title="Get the gaps done" sub="A bot runs the checks on jobs.flisk.si: can AI search find your site, and how good is your README. About 5 minutes. Free and public.">
          <HStack gap={3} align="center" justify="space-between" wrap="wrap" className="gap">
            <VStack gap={1} style={{flex: 1, minWidth: 220}}><Text weight="semibold">Post as jobs on jobs.flisk.si</Text><Text type="supporting" color="secondary">One public job per gap. You can delete them any time.</Text></VStack>
            <Button label="Post as jobs" variant="primary" />
          </HStack>
        </Section>

        <Section title="Can AI search find it" sub="ChatGPT, Claude and Perplexity answer from pages they can read. Citable checks yours.">
          <div className="cols">
            <HStack gap={3} align="center">
              <div className="ring" style={{'--p': p.check.score}}><b>{p.check.score}<small>/100 · {p.check.grade}</small></b></div>
              <VStack gap={2}><Text weight="semibold">Not readable yet</Text><Text type="supporting" color="secondary">3 things stop AI search.</Text>
                <Button label="Full report on Citable" size="sm" variant="secondary" href={p.check.report} target="_blank" icon={ic(ArrowTopRightOnSquareIcon)} /></VStack>
            </HStack>
            <VStack gap={3}>{p.check.fixes.map((f) => (
              <HStack key={f.title} gap={2} align="start"><Badge label={f.status === 'fail' ? 'Fail' : 'Warn'} variant={f.status === 'fail' ? 'error' : 'warning'} />
                <VStack gap={0}><Text weight="semibold">{f.title}</Text><Text type="supporting" color="secondary">{f.summary}</Text></VStack></HStack>))}</VStack>
          </div>
        </Section>

        <Section title="Who would buy it">
          <div className="cols">
            <Heading level={3}>{p.pitch}</Heading>
            <VStack gap={3}><Text>{p.buyers}</Text>
              <Card variant="blue"><VStack gap={1}><Text type="supporting" weight="semibold">Do this today</Text><Text>{p.today}</Text></VStack></Card></VStack>
          </div>
        </Section>

        <Section title="Where to find them" sub="Places these buyers already talk. Read the rules of each place before you post.">
          <div className="grid">{p.places.map((x) => <Cell key={x.name} href={x.url} title={x.name} text={x.why} left={fav(x.name)} />)}</div>
        </Section>
      </>}

      {show('emails') && <Section title="Emails to send" count={p.emails.length} sub="Drafts only. Add the address in your mail and press Send yourself: nothing is sent for you.">
        <div className="grid">{p.emails.map((e) => <Draft key={e.subject} to={'To: ' + e.to} title={e.subject} body={e.body} actions={['Open in Gmail', 'Mail app']} />)}</div>
      </Section>}

      {show('posts') && <Section title="Posts to write" count={p.posts.length} sub="Opens the post box with the text filled in. You read it, change it and post it yourself.">
        <div className="grid">{p.posts.map((x) => <Draft key={x.title} to={x.where} title={x.title} body={x.body} actions={['Open in ' + x.where]} />)}</div>
      </Section>}

      {show('list') && <Section title="Where to list it" sub="Directories and launch lists. Each one links to its own submit page.">
        <div className="grid">{p.listings.map((x) => <Cell key={x.name} href={x.url} title={x.name} text={x.why} left={fav(x.name)} />)}</div>
      </Section>}
    </VStack></div>
  );
}

function Nav() {
  return (
    <SideNav collapsible
      header={<HStack gap={2} align="center"><span className="brand">G</span><Text type="emphasized">Flisk Grow</Text></HStack>}
      topContent={<Button label="New plan" variant="secondary" icon={ic(PlusIcon)} isFullWidth />}
      footer={<Text type="supporting" color="secondary">No account needed. Sign in only to save a plan.</Text>}>
      <SideNavSection title="Workspace">
        <SideNavItem label="This plan" icon={DocumentTextIcon} isSelected />
        <SideNavItem label="My cabinet" icon={HomeIcon} />
      </SideNavSection>
      <SideNavSection title="In this plan">
        <SideNavItem label="AI search check" icon={MagnifyingGlassIcon} />
        <SideNavItem label="Who would buy it" icon={UsersIcon} />
        <SideNavItem label="Where to find them" icon={MapPinIcon} />
        <SideNavItem label="Emails" icon={EnvelopeIcon} />
        <SideNavItem label="Posts" icon={PencilSquareIcon} />
        <SideNavItem label="Where to list it" icon={ListBulletIcon} />
      </SideNavSection>
    </SideNav>
  );
}

function App() {
  const [open, setOpen] = useState(false);
  const drawer = <MobileNav header="Flisk Grow"><SideNavRenderContext value="drawer-content"><Nav /></SideNavRenderContext></MobileNav>;
  return (
    <AppShell height="fill" mobileNav={{hasToggle: false, isOpen: open, onOpenChange: setOpen, content: drawer}}
      topNav={<HStack gap={2} align="center" justify="space-between" style={{padding: 'var(--spacing-2) var(--spacing-3)'}}>
        <HStack gap={1} align="center"><MobileNavToggle /><Text type="supporting" color="secondary">Plans / grow.flisk.si</Text></HStack>
      </HStack>}
      sideNav={<Nav />}>
      <div style={{height: '100%', overflow: 'auto'}}><Plan /></div>
    </AppShell>
  );
}

createRoot(document.getElementById('root')).render(<Theme theme={themes[defaultThemeSlug]} mode="system"><App /></Theme>);
