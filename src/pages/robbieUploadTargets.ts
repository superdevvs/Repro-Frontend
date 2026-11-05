import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { transformShootFromApi, type ApiShoot } from '@/context/shootNormalization';
import { resolveUploadServiceTargets, type UploadActor } from '@/components/shoots/tabs/media/mediaUploadUtils';
import { resolveUploadLanesForFiles } from '@/components/shoots/tabs/media/uploadIntakeLanes';

export async function getRobbieUploadTargets(shootId: string | number, files: File[], actor: UploadActor) {
  const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}`, { headers: getApiHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Could not review this shoot’s upload services.');
  const shoot = transformShootFromApi((data.data ?? data) as ApiShoot);
  return resolveUploadServiceTargets(shoot, actor, 'raw', resolveUploadLanesForFiles(files));
}
