/* global cy, expect */

import { richCaretakerScenario } from '../support/scenarios';

describe('AuraTrack core flows', () => {
  it('navigates seeded caretaker data across history, medications, wellbeing, EEG, and export', () => {
    cy.launchAuraTrack(richCaretakerScenario());

    cy.contains('button', 'START TIMER').should('be.visible');
    cy.contains('Focal Aware').should('exist');

    cy.contains('button', 'HISTORY').click();
    cy.contains('EEG Diary').should('be.visible');
    cy.contains('Wellbeing').should('exist');
    cy.contains('2 EVENTS').should('be.visible');
    cy.window().then((win) => {
      const tabTexts = [...win.document.querySelectorAll('button')]
        .map(button => button.textContent?.trim())
        .filter(text => ['Seizures', 'Medications', 'Wellbeing', 'EEG Diary', 'Export'].includes(text));
      expect(tabTexts).to.deep.equal(['Seizures', 'Medications', 'Wellbeing', 'EEG Diary', 'Export']);
    });

    cy.get('input[type="date"]').eq(0).clear().type('2026-06-08');
    cy.get('input[type="date"]').eq(1).clear().type('2026-06-08');
    cy.contains('No events found.').should('be.visible');

    cy.contains('button', 'Clear').click();
    cy.contains('Tonic-Clonic').should('be.visible');

    cy.openTab('Medications');
    cy.contains('Lamotrigine').should('be.visible');
    cy.contains('Diazepam').should('be.visible');

    cy.openTab('Wellbeing');
    cy.contains('Correlation overview').should('be.visible');
    cy.contains('Calm').should('be.visible');
    cy.contains('Sleep quality: Restful').should('be.visible');

    cy.openTab('EEG Diary');
    cy.contains('Home EEG Session').should('be.visible');
    cy.contains(/Seizure reference/i).should('be.visible');

    cy.openTab('Export');
    cy.contains('Neurologist Report').should('exist');
    cy.contains('Seizure Diary (Monthly)').scrollIntoView().should('be.visible');
    cy.get('input[type="month"]').should('have.value', '2026-06');

    cy.contains('button', 'SETTINGS').click();
    cy.openTab('Medications');
    cy.contains('Lamotrigine').should('be.visible');
    cy.contains('Diazepam').should('be.visible');
  });

  it('uses the selected report date range instead of a hardcoded 30-day period', () => {
    cy.launchAuraTrack(richCaretakerScenario());

    cy.contains('button', 'HISTORY').click();
    cy.openTab('Export');
    cy.get('input[type="date"]').eq(0).clear().type('2026-06-06');
    cy.get('input[type="date"]').eq(1).clear().type('2026-06-07');
    cy.contains('p', 'Neurologist Report')
      .closest('.ui-card')
      .within(() => {
        cy.contains('button', 'Open Preview').click();
      });

    cy.contains('2 selected days').should('be.visible');
    cy.contains('last 30 days').should('not.exist');
    cy.contains('Events (2d)').should('be.visible');
  });

  it('adds a medication and logs a manual seizure through the UI', () => {
    cy.launchAuraTrack();

    cy.contains('button', 'SETTINGS').click();
    cy.openTab('Medications');
    cy.contains('button', '+ Add Medication').click();

    cy.get('input[placeholder="Drug name (e.g. Levetiracetam)"]').type('Test Med');
    cy.get('input[placeholder="Dose"]').type('50');
    cy.contains('button', /^Add$/).click();
    cy.contains('button', 'Confirm & record').click();

    cy.contains('Test Med').should('be.visible');

    cy.contains('button', 'BACK').click();
    cy.contains('button', 'Log Past Seizure').click();

    cy.get('input[inputmode="numeric"]').eq(0).click().type('1');
    cy.get('input[inputmode="numeric"]').eq(1).click().type('30');
    cy.contains('button', 'Continue').click();

    cy.contains('Step 1: Seizure Type').should('be.visible');
    cy.contains('button', 'Skip for now').click();

    cy.contains('button', 'HISTORY').click();
    cy.contains('Uncategorized').should('be.visible');
    cy.contains('Manual Entry').should('be.visible');
  });

  it('shows the emergency overlay after 5 minutes of total elapsed time even before aura ends', () => {
    const resumedStartTime = Date.now() - 301000;
    cy.launchAuraTrack(richCaretakerScenario());
    cy.window().then((win) => {
      win.localStorage.setItem('aura_startTime', String(resumedStartTime));
      win.localStorage.setItem('aura_status', 'RECORDING');
    });
    cy.reload();

    cy.contains('MEDICAL EMERGENCY').should('be.visible');
    cy.contains('END AURA TIMER').should('exist');
  });

  it('captures post-ictal findings in the dedicated recovery section', () => {
    cy.launchAuraTrack();

    cy.contains('button', 'START TIMER').click();
    cy.contains('button', 'STOP TIMER').click();
    cy.contains('button', 'Tonic-Clonic').click();
    cy.contains('button', 'Continue to Summary').click();
    cy.contains('button', 'Confused / disoriented').scrollIntoView().click();
    cy.contains('button', 'Drowsy / fell asleep').click();
    // A finding that affects a body part asks where
    cy.contains('button', 'Paralysis (Todd’s)').click();
    cy.contains('button', 'Arms').click();
    cy.contains('button', 'Left Arm').click();
    cy.contains('button', 'Hand/Fingers').click();
    cy.contains('button', 'Add 1 area').click();
    cy.contains('Arms › Left Arm › Hand/Fingers').scrollIntoView().should('be.visible');
    cy.contains('button', 'Confused / disoriented').should('have.attr', 'aria-pressed', 'true');
  });
});
