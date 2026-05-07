from apps.cashbook.models import CashbookEntry
from datetime import date

today = date.today()
updated = CashbookEntry.objects.filter(status='confirmed', date__gt=today).update(date=today)
print(f'Fixed {updated} future entries in the DB.')
