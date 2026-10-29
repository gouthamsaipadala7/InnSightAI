# Data sources
- Real data: Kaggle "Hotel Booking Demand" (jessemostipak/hotel-booking-demand), file hotel_bookings.csv. Downloaded: 13 September 2026 19:43:31. Not committed (license/size); re-download from Kaggle into data/raw/.
- Synthetic data: 3 hotels, see ../DATASET.md (v1-unseeded).
- Experiments: scripts/run_coldstart_eval.py, run_multiwindow_eval.py -> experiments/*.csv, *.png
- Python/library versions: record `pip freeze` output in requirements.txt
- data/processed/daily_booking_counts_combined.csv: MIXED file. source=kaggle_pretrain (2 real Kaggle hotels, 793 days each) + source=platform_tenant (3 synthetic hotels, ~270 days each, dataset v1-unseeded). Any result computed on platform_tenant rows is synthetic-data result. Always filter by `source`.