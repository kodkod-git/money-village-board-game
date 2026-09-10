import styles from './AdminAssetSummary.module.css'

export default function AdminAssetSummary({ labels, images, values, folder, unit, testIdPrefix }) {
  const holdings = Object.keys(labels).filter(key => Number(values?.[key] ?? 0) > 0)

  if (holdings.length === 0) {
    return <span className={styles.emptyAsset}>미보유</span>
  }

  return (
    <div className={styles.assetList}>
      {holdings.map(key => {
        const amount = Number(values[key] ?? 0)
        return (
          <div key={key} className={styles.assetRow} data-testid={`${testIdPrefix}-${key}`}>
            <img
              src={`/badges/${folder}/${images[key]}.png`}
              alt={labels[key]}
              className={styles.assetIcon}
            />
            <span className={styles.assetName}>{labels[key]}</span>
            <span className={styles.assetAmount}>{amount}{unit}</span>
          </div>
        )
      })}
    </div>
  )
}
