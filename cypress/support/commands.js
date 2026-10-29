/* global Cypress, cy */

import { launchAuraTrackWithState, countRowsInStore } from './database';

Cypress.Commands.add('launchAuraTrack', (seed = {}) => {
  launchAuraTrackWithState(seed);
});

Cypress.Commands.add('countStoreRows', (storeName) => {
  return cy.window().then((win) => countRowsInStore(win, storeName));
});

// Tabs render as chips on wide screens and as a dropdown below 480px wide
Cypress.Commands.add('openTab', (label) => {
  cy.get('body').then(($body) => {
    const select = [...$body.find('select.ui-tabs-select')].find(el => el.offsetParent !== null);
    if (select) {
      const option = [...select.options].find(o => o.text.trim().toLowerCase() === label.toLowerCase());
      cy.wrap(select).select(option.value);
    } else {
      cy.contains('button', new RegExp(`^${label}$`, 'i')).scrollIntoView().click();
    }
  });
});
