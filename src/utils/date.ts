let timeOffset = 0;

export async function syncServerTime() {
  try {
    const res = await fetch('http://worldtimeapi.org/api/timezone/Asia/Jakarta');
    const data = await res.json();
    const serverTime = new Date(data.datetime).getTime();
    const localTime = new Date().getTime();
    timeOffset = serverTime - localTime;
    console.log("Time offset synced:", timeOffset, "ms");
  } catch (e) {
    console.warn("Failed to sync server time, falling back to local device time.", e);
  }
}

export function getOperationalDate(): string {
  try {
    const d = new Date(new Date().getTime() + timeOffset);
    
    // Use Intl if available for correct timezone casting
    if (typeof Intl !== 'undefined') {
      const parts = new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(d);
      
      const year = parts.find(p => p.type === 'year')?.value;
      const month = parts.find(p => p.type === 'month')?.value;
      const day = parts.find(p => p.type === 'day')?.value;
      
      if (year && month && day) return `${year}-${month}-${day}`;
    }
  } catch (e) {
    // fallback
  }

  // Fallback math for UTC+7
  const d = new Date(new Date().getTime() + timeOffset);
  const offset = 7 * 60; // +7 hours in minutes
  const localTime = d.getTime() + (d.getTimezoneOffset() + offset) * 60000;
  const localDate = new Date(localTime);
  return localDate.toISOString().split('T')[0];
}

