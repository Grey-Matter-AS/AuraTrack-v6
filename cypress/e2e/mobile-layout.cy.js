/* global cy, expect */

import { richCaretakerScenario } from '../support/scenarios';

const supportedLocales = ['en', 'nb', 'nn', 'da', 'de', 'fr', 'es', 'sv', 'fi'];

function getHeaderControls(win) {
  return {
    brand: win.document.querySelector('.app-header__brand-title'),
    historyButton: win.document.querySelector('.app-header__history'),
    settingsButton: win.document.querySelector('.app-header__settings'),
    helpButton: win.document.querySelector('.app-header__help'),
  };
}

function getStartButton(win) {
  return [...win.document.querySelectorAll('button')]
    .find((button) => button.classList.contains('bg-red-600'));
}

function clickStartButton() {
  cy.window().then((win) => {
    const startButton = getStartButton(win);
    expect(startButton).to.not.equal(undefined);
    cy.wrap(startButton).click();
  });
}

function centerX(rect) {
  return rect.left + rect.width / 2;
}

function expectNoRectOverlap(first, second, label) {
  const separated =
    first.right <= second.left ||
    second.right <= first.left ||
    first.bottom <= second.top ||
    second.bottom <= first.top;

  expect(separated, `${label} do not overlap`).to.equal(true);
}

describe('AuraTrack mobile layout', () => {
  it('separates the header actions cleanly on narrow phones', () => {
    cy.viewport(320, 568);
    cy.launchAuraTrack(richCaretakerScenario());

    cy.window().then((win) => {
      const { historyButton, settingsButton, helpButton } = getHeaderControls(win);

      expect(historyButton).to.not.equal(null);
      expect(settingsButton).to.not.equal(null);
      expect(helpButton).to.not.equal(null);

      const historyRect = historyButton.getBoundingClientRect();
      const settingsRect = settingsButton.getBoundingClientRect();
      const helpRect = helpButton.getBoundingClientRect();

      expect(Math.abs(historyRect.top - settingsRect.top)).to.be.lessThan(2);
      expect(Math.abs(helpRect.height - settingsRect.height)).to.be.lessThan(3);
      expect(settingsRect.left).to.be.greaterThan(historyRect.right);
      expect(settingsRect.top).to.be.greaterThan(helpRect.bottom - 2);
      expect(win.document.documentElement.scrollWidth - win.document.documentElement.clientWidth).to.be.lessThan(3);
    });
  });

  it('keeps the header brand centered above Start on wide and landscape screens', () => {
    [
      [1180, 820],
      [852, 393],
    ].forEach(([width, height]) => {
      cy.viewport(width, height);
      cy.launchAuraTrack(richCaretakerScenario());

      cy.window().then((win) => {
        const { brand, historyButton, settingsButton, helpButton } = getHeaderControls(win);
        const startButton = getStartButton(win);

        expect(brand).to.not.equal(null);
        expect(historyButton).to.not.equal(null);
        expect(settingsButton).to.not.equal(null);
        expect(helpButton).to.not.equal(null);
        expect(startButton).to.not.equal(undefined);

        const brandRect = brand.getBoundingClientRect();
        const historyRect = historyButton.getBoundingClientRect();
        const settingsRect = settingsButton.getBoundingClientRect();
        const helpRect = helpButton.getBoundingClientRect();
        const startRect = startButton.getBoundingClientRect();
        const brandCenter = centerX(brandRect);
        const startCenter = centerX(startRect);
        const leftGap = startCenter - historyRect.right;
        const rightGap = settingsRect.left - startCenter;

        expect(Math.abs(startCenter - win.innerWidth / 2)).to.be.lessThan(2);
        expect(Math.abs(brandCenter - startCenter)).to.be.lessThan(2);
        expect(Math.abs(leftGap - rightGap)).to.be.lessThan(2);
        expect(settingsRect.right).to.be.lessThan(helpRect.left);
        expect(Math.abs(settingsRect.top - helpRect.top)).to.be.lessThan(2);
        expect(win.document.documentElement.scrollWidth - win.document.documentElement.clientWidth).to.be.lessThan(3);
      });
    });
  });

  it('prevents header button overlap on small iOS-style screens', () => {
    [
      { name: 'iPhone SE portrait', width: 320, height: 568 },
      { name: 'iPhone 8 portrait', width: 375, height: 667 },
      { name: 'iPhone 16 portrait', width: 393, height: 852 },
      { name: 'iPhone 16 Pro Max portrait', width: 430, height: 932 },
      { name: 'iPhone SE landscape', width: 568, height: 320 },
      { name: 'iPhone 8 landscape', width: 667, height: 375 },
      { name: 'iPhone 16 landscape', width: 852, height: 393 },
    ].forEach(({ name, width, height }) => {
      cy.viewport(width, height);
      cy.launchAuraTrack(richCaretakerScenario());

      cy.window().then((win) => {
        const { brand, historyButton, settingsButton, helpButton } = getHeaderControls(win);
        const startButton = getStartButton(win);
        const controls = [
          ['brand', brand],
          ['history', historyButton],
          ['settings', settingsButton],
          ['help', helpButton],
          ['start', startButton],
        ];

        controls.forEach(([label, element]) => {
          expect(element, `${name} ${label} exists`).to.not.equal(null);
          expect(element, `${name} ${label} exists`).to.not.equal(undefined);
          const rect = element.getBoundingClientRect();

          expect(rect.width, `${name} ${label} width`).to.be.greaterThan(0);
          expect(rect.height, `${name} ${label} height`).to.be.greaterThan(0);
          expect(rect.left, `${name} ${label} left`).to.be.at.least(0);
          expect(rect.right, `${name} ${label} right`).to.be.at.most(win.innerWidth);
        });

        const headerPairs = [
          ['brand', brand],
          ['history', historyButton],
          ['settings', settingsButton],
          ['help', helpButton],
        ];

        for (let firstIndex = 0; firstIndex < headerPairs.length; firstIndex += 1) {
          for (let secondIndex = firstIndex + 1; secondIndex < headerPairs.length; secondIndex += 1) {
            const [firstLabel, firstElement] = headerPairs[firstIndex];
            const [secondLabel, secondElement] = headerPairs[secondIndex];

            expectNoRectOverlap(
              firstElement.getBoundingClientRect(),
              secondElement.getBoundingClientRect(),
              `${name} ${firstLabel}/${secondLabel}`,
            );
          }
        }

        expect(win.document.documentElement.scrollWidth - win.document.documentElement.clientWidth).to.be.lessThan(3);
      });
    });
  });

  it('keeps translated Start button text within the circular bounds', () => {
    supportedLocales.forEach((locale) => {
      const scenario = richCaretakerScenario();

      cy.viewport(393, 852);
      cy.launchAuraTrack({
        ...scenario,
        settings: [
          ...scenario.settings.filter((setting) => setting.key !== 'language'),
          { key: 'language', value: locale },
        ],
      });

      cy.window().then((win) => {
        const startButton = getStartButton(win);

        expect(startButton, `${locale} start button exists`).to.not.equal(undefined);
        expect(startButton.scrollWidth - startButton.clientWidth, `${locale} horizontal fit`).to.be.lessThan(2);
        expect(startButton.scrollHeight - startButton.clientHeight, `${locale} vertical fit`).to.be.lessThan(2);
      });
    });
  });

  it('shows the extra dose control as a visible button', () => {
    cy.viewport(390, 844);
    cy.launchAuraTrack(richCaretakerScenario());

    cy.window().then((win) => {
      const button = [...win.document.querySelectorAll('button')]
        .filter((candidate) => candidate.classList.contains('w-full'))
        .find((candidate) => {
          const rect = candidate.getBoundingClientRect();
          return rect.width > 200 && rect.height > 36 && candidate.textContent?.trim().startsWith('+');
        });

      expect(button).to.not.equal(undefined);
      const style = getComputedStyle(button);

      expect(style.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
      expect(style.borderTopWidth).to.not.equal('0px');
      expect(button.getBoundingClientRect().height).to.be.greaterThan(36);
    });
  });

  it('keeps export date selectors stacked on narrow screens', () => {
    cy.viewport(320, 568);
    cy.launchAuraTrack(richCaretakerScenario());
    cy.get('.app-header__history').click();
    cy.openTab('Export');

    cy.window().then((win) => {
      const stacks = [...win.document.querySelectorAll('.date-selector-stack')].map((stack) => {
        return [...stack.children].map((child) => child.getBoundingClientRect());
      });
      const monthRect = win.document.querySelector('input[type="month"]')?.getBoundingClientRect();
      const actionRect = win.document.querySelector('.date-selector-actions')?.getBoundingClientRect();

      expect(stacks.length).to.be.greaterThan(0);
      stacks.forEach((children) => {
        for (let index = 1; index < children.length; index += 1) {
          expect(children[index].top).to.be.at.least(children[index - 1].bottom);
          expect(Math.abs(children[index].left - children[index - 1].left)).to.be.lessThan(2);
        }
      });
      expect(monthRect).to.not.equal(undefined);
      expect(actionRect).to.not.equal(undefined);
      expect(actionRect.top).to.be.at.least(monthRect.bottom);
    });
  });

  it('keeps the recording page fully scrollable on small phones', () => {
    cy.viewport(320, 568);
    cy.launchAuraTrack(richCaretakerScenario());
    clickStartButton();

    cy.window().then((win) => {
      const scrollRegion = win.document.querySelector('[data-scroll-region="recording"]');
      const stopButton = [...win.document.querySelectorAll('button')]
        .filter((button) => button.classList.contains('app-action-tile'))
        .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];
      const stopWrapper = stopButton?.parentElement;
      const beforeRect = stopButton?.getBoundingClientRect();

      expect(scrollRegion).to.not.equal(null);
      expect(stopButton).to.not.equal(undefined);
      expect(win.getComputedStyle(stopWrapper).position).to.not.equal('sticky');
      expect(win.getComputedStyle(stopWrapper).position).to.not.equal('fixed');
      expect(scrollRegion.scrollHeight).to.be.greaterThan(scrollRegion.clientHeight);
      expect(beforeRect.top).to.be.greaterThan(win.innerHeight);

      scrollRegion.scrollTop = scrollRegion.scrollHeight;
      scrollRegion.dispatchEvent(new win.Event('scroll'));

      const afterRect = stopButton.getBoundingClientRect();
      expect(afterRect.bottom).to.be.at.most(win.innerHeight);
      expect(afterRect.top).to.be.at.least(0);
    });
  });

  [
    { name: 'phone landscape', width: 568, height: 320 },
    { name: 'tablet portrait', width: 820, height: 1180 },
    { name: 'tablet landscape', width: 1180, height: 820 },
  ].forEach(({ name, width, height }) => {
    it(`keeps key timer controls readable and unclipped on ${name}`, () => {
      cy.viewport(width, height);
      cy.launchAuraTrack(richCaretakerScenario());

      cy.window().then((win) => {
        const root = win.document.documentElement;
        const startButton = getStartButton(win);
        const startRect = startButton?.getBoundingClientRect();

        expect(root.scrollWidth - root.clientWidth).to.be.lessThan(3);
        expect(startButton).to.not.equal(undefined);
        expect(startRect.width).to.be.greaterThan(0);
        expect(startRect.height).to.be.greaterThan(0);
        expect(startButton.scrollWidth - startButton.clientWidth).to.be.lessThan(3);
      });

      clickStartButton();

      cy.window().then((win) => {
        const root = win.document.documentElement;
        const scrollRegion = win.document.querySelector('[data-scroll-region="recording"]');
        const actionButtons = [...win.document.querySelectorAll('button.app-action-tile')];

        expect(root.scrollWidth - root.clientWidth).to.be.lessThan(3);
        expect(actionButtons.length).to.be.at.least(4);
        actionButtons.forEach((button, index) => {
          const rect = button.getBoundingClientRect();

          expect(rect.width, `action ${index} width`).to.be.greaterThan(0);
          expect(rect.height, `action ${index} height`).to.be.greaterThan(0);
          expect(button.scrollWidth - button.clientWidth, `action ${index} text fits`).to.be.lessThan(3);
        });

        if (height < 500) {
          expect(scrollRegion.scrollHeight).to.be.greaterThan(scrollRegion.clientHeight);
        }
      });
    });
  });
});
