const fields = ['height', 'bust', 'waist', 'hip', 'shoulder', 'sleeve'];

function getUnit() {
  return document.querySelector('input[name="unit"]:checked').value;
}

// Pre-fill if measurements already saved
chrome.storage.local.get([...fields, 'unit'], (data) => {
  fields.forEach(f => { if (data[f]) document.getElementById(f).value = data[f]; });
  if (data.unit) {
    document.querySelector(`input[name="unit"][value="${data.unit}"]`).checked = true;
  }
});

document.getElementById('save-btn').addEventListener('click', () => {
  const values = {};
  fields.forEach(f => {
    const v = parseFloat(document.getElementById(f).value);
    if (!isNaN(v)) values[f] = v;
  });

  if (Object.keys(values).length === 0) {
    document.getElementById('error-msg').hidden = false;
    return;
  }

  document.getElementById('error-msg').hidden = true;
  chrome.storage.local.set({ ...values, unit: getUnit() }, () => {
    document.getElementById('success-msg').hidden = false;
    document.getElementById('save-btn').textContent = 'Saved ✓';
    document.getElementById('save-btn').disabled = true;
  });
});
