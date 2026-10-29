/**
 * SROI Calculation Utilities
 *
 * The authoritative SROI calculation engine is the PHP backend:
 * backend/src/Domain/Calculation/CalculationEngine.php
 *
 * The frontend does NOT perform standalone SROI calculations.
 * All calculation requests go through the /calculate or /calculator/preview API endpoints.
 *
 * The previous calculateSroi() function in this file used a simplified formula
 * (missing displacement factor, integer-percentage handling differed from the backend)
 * and was never imported anywhere in the application. It has been removed to prevent
 * inconsistencies between frontend previews and authoritative backend results.
 *
 * If a client-side calculation preview is needed in future, it MUST be verified
 * against the backend engine formula documented in AGENTS.md Section 4.
 *
 * Use api.getCalculationPreview() or api.calculate() for all SROI computations.
 */
