import { check } from 'k6'
import { browser } from 'k6/browser'

export const options = {
  scenarios: {
    ui: {
      executor: 'shared-iterations',
      options: {
        browser: {
          type: 'chromium',
        },
      },
    },
  },
  thresholds: {
    checks: ['rate==1.0'],
  },
}

export default async function () {
  const page = await browser.newPage()

  try {
    await page.goto('https://quickpizza.grafana.com/admin')

    await page.locator('input[name="username"]').fill('admin')
    await page.locator('input[name="password"]').fill('admin')

    await page.waitForLoadState('networkidle') // waits until the `networkidle` event

    await page.locator('button[type="submit"]').click()

    const label = await page.locator('h2')
    const textContent = (await label.textContent()).trim()

    check(textContent, {
      header: (t) => t === 'Latest pizza recommendations',
    })
  } finally {
    await page.close()
  }
}
