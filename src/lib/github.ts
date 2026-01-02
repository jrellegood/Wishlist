const GITHUB_OWNER = import.meta.env.VITE_GITHUB_OWNER || '';
const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO || '';
const GITHUB_PAT = import.meta.env.VITE_GITHUB_PAT || '';

export async function markGiftAsBought(giftId: string): Promise<void> {
  if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_PAT) {
    throw new Error('GitHub configuration is missing. Please check environment variables.');
  }

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/mark-bought.yml/dispatches`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${GITHUB_PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: {
        gift_id: giftId,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to mark gift as bought: ${response.status} ${errorText}`);
  }
}
