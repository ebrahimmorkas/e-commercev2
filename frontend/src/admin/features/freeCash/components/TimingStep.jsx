import DatePicker from '../../../../components/common/DatePicker';
import InputField from '../../../../components/common/InputField';
import theme from '../theme/theme';

const pad = (n) => String(n).padStart(2, '0');
// Formats using local calendar fields, not toISOString() - a UTC conversion
// of local midnight can roll over to the previous day in timezones ahead of UTC.
const toDateInputValue = (date) => (date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : '');

/**
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 */
const TimingStep = ({ draft, onChange }) => {
  const set = (patch) => onChange({ ...draft, ...patch });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DatePicker
          label="Start Date"
          name="startDate"
          value={draft.startDate}
          onChange={(date) => set({ startDate: toDateInputValue(date) })}
          required
        />
        <DatePicker
          label="End Date"
          name="endDate"
          value={draft.endDate}
          onChange={(date) => set({ endDate: toDateInputValue(date) })}
          required
        />
      </div>
      <div>
        <InputField
          label="Timezone"
          name="timezone"
          placeholder="e.g. Asia/Kolkata"
          value={draft.timezone}
          onChange={(e) => set({ timezone: e.target.value })}
          showError={false}
        />
        <p className={`mt-1 text-xs ${theme.text.muted}`}>
          The Free Cash can be used from 00:00 on the start date until 23:59 on the end date in this timezone. Start and end can be the
          same day for a one-day campaign.
        </p>
      </div>
    </div>
  );
};

export default TimingStep;
