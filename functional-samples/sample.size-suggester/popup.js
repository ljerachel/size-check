const FIELDS = [
  { key: 'height',   label: 'Height' },
  { key: 'bust',     label: 'Bust' },
  { key: 'waist',    label: 'Waist' },
  { key: 'hip',      label: 'Hip' },
  { key: 'shoulder', label: 'Shoulder width' },
  { key: 'sleeve',   label: 'Sleeve length' },
];

function openOnboarding() {
  chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
}

chrome.storage.local.get([...FIELDS.map(f => f.key), 'unit'], (data) => {
  const unit = data.unit || 'cm';
  const saved = FIELDS.filter(f => data[f.key] != null);

  if (saved.length === 0) {
    document.getElementById('no-measurements').hidden = false;
    document.getElementById('setup-btn').addEventListener('click', openOnboarding);
  } else {
    document.getElementById('has-measurements').hidden = false;
    const list = document.getElementById('measurement-list');
    saved.forEach(f => {
      const li = document.createElement('li');
      li.textContent = `${f.label}: ${data[f.key]} ${unit}`;
      list.appendChild(li);
    });
    document.getElementById('edit-btn').addEventListener('click', openOnboarding);
  }
});
