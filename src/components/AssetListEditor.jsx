import AssetCard from './AssetCard'
import styles from '../pages/IndividualPage.module.css'

export default function AssetListEditor({ labels, images, priceLabels, imageFolder, values, onChange }) {
  return (
    <div className={styles.assetList}>
      {Object.keys(labels).map(key => (
        <AssetCard
          key={key}
          image={`/badges/${imageFolder}/${images[key]}.png`}
          label={labels[key]}
          price={priceLabels[key]}
          value={values[key]}
          onChange={val => onChange(key, val)}
        />
      ))}
    </div>
  )
}
