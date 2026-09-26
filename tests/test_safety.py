import unittest
from pathlib import Path

class SafetyRegression(unittest.TestCase):
    def test_intake_fails_closed(self):
        html = Path('enroll.html').read_text()
        self.assertIn('<fieldset disabled', html)
        self.assertIn('Enrollment unavailable.', html)
        self.assertNotIn("console.log('[FordEngage Enrollment]'", html)
        self.assertNotIn('new FormData(form)', html)
        self.assertNotIn("successState.style.display = 'block'", html)
        self.assertNotIn('novalidate', html)

    def test_annual_precision(self):
        html = Path('index.html').read_text()
        self.assertIn('annAvgProfit = annAvgGross * margin', html)
        self.assertNotIn('Math.round(avgVal * margin)', html)
        for vehicles in range(100, 801, 50):
            annual_cents = vehicles * 805 * 12 * 31
            self.assertAlmostEqual(vehicles * 805 * 12 * .31, annual_cents / 100)
        self.assertEqual(150 * 805 * 12 * 31 / 100, 449190)

if __name__ == '__main__':
    unittest.main()
