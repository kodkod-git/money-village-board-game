import AssetCard from './AssetCard'
import styles from '../pages/IndividualPage.module.css'

export default function AssetListEditor({ labels, images, priceLabels, imageFolder, values, onChange, fill = false }) {
  const fourItems = Object.keys(labels).length === 4
  return (
    <div className={`${styles.assetList} ${fill ? styles.assetListFill : ''} ${fill && fourItems ? styles.assetListFillFour : ''}`}>
      {Object.keys(labels).map(key => (
        <AssetCard
          key={key}
          image={`/badges/${imageFolder}/${images[key]}.png`}
          label={labels[key]}
          price={priceLabels[key]}
          value={values[key] ?? 0}
          onChange={val => onChange(key, val)}
        />
      ))}
    </div>
  )
}
