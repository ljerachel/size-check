const CM_PER_INCH = 2.54;

function convertUnit(value, from, to) {
  if (from === to) return value;
  return from === 'cm' ? value / CM_PER_INCH : value * CM_PER_INCH;
}

function pickSize(userMeasurements, userUnit, chart) {
  const dims = ['bust', 'waist', 'hip', 'shoulder', 'sleeve', 'height'];
  let bestRow = null;
  let bestScore = -Infinity;

  for (const row of chart.rows) {
    let okCount = 0;
    let totalGap = 0;
    const fitDetail = {};

    for (const dim of dims) {
      if (!row[dim]) continue;
      const [rMin, rMax] = row[dim].map(v => convertUnit(v, chart.unit, userUnit));
      const userVal = userMeasurements[dim];
      if (userVal == null) continue;

      if (userVal < rMin) {
        fitDetail[dim] = { fit: 'LOOSE', gap: +(rMin - userVal).toFixed(1) };
        totalGap += rMin - userVal;
      } else if (userVal > rMax) {
        fitDetail[dim] = { fit: 'TIGHT', gap: +(userVal - rMax).toFixed(1) };
        totalGap += userVal - rMax;
      } else {
        fitDetail[dim] = { fit: 'OK', gap: 0 };
        okCount++;
      }
    }

    const score = okCount * 100 - totalGap;
    if (score > bestScore) {
      bestScore = score;
      bestRow = { label: row.label, fitDetail };
    }
  }

  return bestRow;
}

function buildCaveats(fitDetail, userUnit) {
  const caveats = [];

  const loose = {
    bust:     (gap) => ({ tag: 'loose in bust',          detail: `${gap} ${userUnit} room in the bust` }),
    waist:    (gap) => ({ tag: 'loose in waist',         detail: `${gap} ${userUnit} room in the waist` }),
    hip:      (gap) => ({ tag: 'loose in hip',           detail: `${gap} ${userUnit} room in the hips` }),
    shoulder: (gap) => ({ tag: 'wide in shoulders',      detail: `${gap} ${userUnit} room across the shoulders` }),
    sleeve:   (gap) => ({ tag: 'long in the sleeve',     detail: `sleeve is ${gap} ${userUnit} longer than your arm` }),
    height:   (gap) => ({ tag: 'may be long on you',     detail: `you are ${gap} ${userUnit} shorter than this size's height range` }),
  };

  const tight = {
    bust:     (gap) => ({ tag: 'tight in bust',          detail: `needs ${gap} ${userUnit} more in the bust` }),
    waist:    (gap) => ({ tag: 'tight in waist',         detail: `needs ${gap} ${userUnit} more in the waist` }),
    hip:      (gap) => ({ tag: 'tight in hip',           detail: `needs ${gap} ${userUnit} more in the hips` }),
    shoulder: (gap) => ({ tag: 'narrow in shoulders',    detail: `shoulders are ${gap} ${userUnit} too narrow` }),
    sleeve:   (gap) => ({ tag: 'short in the sleeve',    detail: `sleeve is ${gap} ${userUnit} shorter than your arm` }),
    height:   (gap) => ({ tag: 'may be short on you',    detail: `you are ${gap} ${userUnit} taller than this size's height range` }),
  };

  for (const [dim, info] of Object.entries(fitDetail)) {
    if (info.fit === 'LOOSE' && loose[dim]) caveats.push(loose[dim](info.gap));
    if (info.fit === 'TIGHT' && tight[dim]) caveats.push(tight[dim](info.gap));
  }

  return caveats;
}
