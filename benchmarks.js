// benchmarks.js — 2026 fair-price and production benchmarks by US state.
// $/W = fair installed cost per watt (cash, before incentives), 2026 market.
// yield = realistic annual specific yield (kWh per kW of DC, south-facing).
// These are calibrated estimates (EnergySage ~$2.60/W US avg 2026; PVWatts-class
// yields). Precision per state is less important than the audit logic; values are
// easy to tune in one place.

const REGION = {
  SW: { low: 2.3, high: 3.1, yield: 1600 }, // AZ NV NM UT CO
  CA: { low: 2.6, high: 3.5, yield: 1550 }, // high labor, high sun
  TX: { low: 2.2, high: 3.0, yield: 1450 },
  SE: { low: 2.3, high: 3.0, yield: 1350 }, // FL GA NC SC ...
  NEAST: { low: 2.7, high: 3.7, yield: 1200 }, // high labor, lower sun
  MW: { low: 2.4, high: 3.2, yield: 1250 },
  NW: { low: 2.5, high: 3.3, yield: 1150 },
  HI: { low: 3.0, high: 4.2, yield: 1500 },
  US: { low: 2.4, high: 3.3, yield: 1350 }, // national default
};

const STATE_REGION = {
  AZ: 'SW', NV: 'SW', NM: 'SW', UT: 'SW', CO: 'SW',
  CA: 'CA', TX: 'TX', HI: 'HI',
  FL: 'SE', GA: 'SE', NC: 'SE', SC: 'SE', TN: 'SE', AL: 'SE', MS: 'SE', LA: 'SE', AR: 'SE', OK: 'SE', VA: 'SE', KY: 'SE',
  NY: 'NEAST', NJ: 'NEAST', MA: 'NEAST', CT: 'NEAST', PA: 'NEAST', RI: 'NEAST', NH: 'NEAST', VT: 'NEAST', ME: 'NEAST', MD: 'NEAST', DE: 'NEAST', WV: 'NEAST',
  IL: 'MW', OH: 'MW', MI: 'MW', IN: 'MW', WI: 'MW', MN: 'MW', IA: 'MW', MO: 'MW', KS: 'MW', NE: 'MW', ND: 'MW', SD: 'MW',
  WA: 'NW', OR: 'NW', ID: 'NW', MT: 'NW', WY: 'NW', AK: 'NW',
};

export const STATES = [
  ['US', 'United States (avg)'], ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['FL', 'Florida'],
  ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
  ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'],
  ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'],
  ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'],
  ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];

export function benchmarkFor(stateCode) {
  const region = STATE_REGION[stateCode] || 'US';
  const b = REGION[region] || REGION.US;
  return { ...b, region, state: stateCode };
}
