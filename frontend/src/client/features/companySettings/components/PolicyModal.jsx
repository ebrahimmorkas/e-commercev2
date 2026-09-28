import Modal from '../../../../components/common/Modal';
import PolicyContent from './PolicyContent';

/**
 * Company Settings > Policies > "How should these open?" set to Modal popup -
 * shows one policy's content without leaving the current page.
 *
 * @param {{key: string, label: string} | null} props.link
 * @param {string} props.html
 * @param {() => void} props.onClose
 */
const PolicyModal = ({ link, html, onClose }) => (
  <Modal isOpen={!!link} onClose={onClose} title={link?.label || ''} size="lg">
    <PolicyContent html={html} />
  </Modal>
);

export default PolicyModal;
