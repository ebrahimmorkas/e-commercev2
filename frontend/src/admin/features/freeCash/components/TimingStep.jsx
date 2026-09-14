import DatePicker from '../../../../components/common/DatePicker';

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
    </div>
  );
};

export default TimingStep;
