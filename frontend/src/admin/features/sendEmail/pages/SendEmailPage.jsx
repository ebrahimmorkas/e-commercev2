import { useState } from 'react';
import Card from '../../../../components/common/Card';
import Tabs from '../../../../components/common/Tabs';
import Spinner from '../../../../components/common/Spinner';
import Alert from '../../../../components/common/Alert';
import ComposeEmailForm from '../components/ComposeEmailForm';
import SentEmailHistory from '../components/SentEmailHistory';
import { useSendEmail } from '../hooks/useSendEmail';

/**
 * "Send Email" module: compose an email to customers (and, when allowed,
 * other addresses) and see the history of what was sent.
 *
 * @param {Array<{_id, name, email}>|null} props.prefillCustomers - To field
 *   pre-filled from the Customers page (row or bulk "Send Email")
 */
const SendEmailPage = ({ prefillCustomers = null }) => {
  const { options, loading, error, sending, send, historyVersion } = useSendEmail();
  const [activeTab, setActiveTab] = useState('compose');

  const handleSend = async (fields, files) => {
    const success = await send(fields, files);
    if (success) setActiveTab('history');
    return success;
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <Card title={<span className="font-bold">Send Email</span>} subtitle="Write an email to your customers and see everything you have sent.">
        {error || !options ? (
          <Alert variant="error">{error || 'Could not load the Send Email page.'}</Alert>
        ) : (
          <>
          {!options.hasEmailAccount && (
            <div className="mb-4">
              <Alert variant="warning" title="Your email account is not set up">
                Emails are sent from your own email account. Add it in Company Settings &gt; Email - until then
                nothing can be sent.
              </Alert>
            </div>
          )}
          <Tabs
            variant="pills"
            value={activeTab}
            onChange={setActiveTab}
            items={[
              { key: 'compose', label: 'Compose', content: <ComposeEmailForm options={options} onSend={handleSend} sending={sending} initialCustomers={prefillCustomers} /> },
              { key: 'history', label: 'History', content: <SentEmailHistory refreshKey={historyVersion} /> },
            ]}
          />
          </>
        )}
      </Card>
    </div>
  );
};

export default SendEmailPage;
