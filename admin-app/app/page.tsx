import TrainingWorkspace from '@/components/training-workspace';
import PilotWorkspace from '@/components/pilot-workspace';
import { runtimeEnv } from '@/lib/server/context';

export default function Home() {
  const config = runtimeEnv();
  const pilotConfigured = !!(
    config.DB &&
    config.HSE_ACCESS_TEAM_DOMAIN?.trim() &&
    config.HSE_ACCESS_AUD?.trim()
  );
  return pilotConfigured ? <PilotWorkspace /> : <TrainingWorkspace />;
}
