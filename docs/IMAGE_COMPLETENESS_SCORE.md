## 2026-04-23 note
Image scoring is still a rule-based completeness score only. No AI quality rating has been added in this pass.

<!-- Reviewed during 2026-04-22 workflow guardrail, portable scheduler sync, and repo-alignment pass. -->
# Image Completeness Score

This score is a rule-based completeness score. It is not an AI quality rating.

## Current row-level weighting
- 20 points if the row has an image URL
- 15 points if alt text is present and at least 5 characters
- 20 points if the image is at least 1200×1200
- 12 points if the image is at least 800×800 but under 1200×1200
- 20 points for the first image if the orientation is square or landscape
- 10 points for later images if orientation is recognized
- 15 points if crop history exists
- 5 points if a caption exists
- 5 points if an image title exists

Each row is capped at 100.

## Admin scoring display
- Image score = average of all image row scores
- First-image score = score of the first image only

## First-image save guardrails
The lead image is checked more strictly before save:
- it must be square or landscape
- it must be at least 1200×1200
- alt text must be at least 12 characters
- first-image score must be at least 70%

## Upload-time local file checks
Before upload, the local file is checked against these minimums:
- general image minimum: 800×800 and square/landscape
- first image target: 1200×1200 and square/landscape

## Current meaning
This score is currently about completeness and merchandising readiness signals such as:
- image present
- usable alt text
- sufficient size
- acceptable orientation
- crop history recorded
- caption/title present

## Future merchandising-score ideas
Future work can add a separate merchandising score or a deeper second-pass score for signals such as:
- background consistency
- subject fill in frame
- blur or sharpness checks
- brightness and contrast checks
- duplicate-angle penalty
- lifestyle shot bonus versus plain record-shot evidence


## Clarification
This is meant as a merchandising-completeness signal for Admin workflow and save guardrails. It should not be described to operators as an AI quality score, photo-aesthetic score, or subjective product-image judgment.
